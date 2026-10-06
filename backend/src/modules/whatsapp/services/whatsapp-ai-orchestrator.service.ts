/**
 * WhatsApp AI Orchestrator Service
 *
 * Coordinates the AI pipeline for a WhatsApp inbound message:
 *  1. Construct a safe, curated prompt context (NO secrets, NO raw DB IDs exposed to AI)
 *  2. Call the AI provider for intent classification and entity extraction
 *  3. Validate AI output with Zod (server-side — never trust LLM output directly)
 *  4. Dispatch to the appropriate WhatsApp booking tool
 *  5. Return the bot reply text
 *
 * Security Contract:
 *  - AI never receives tenantId, clinicId, patientId, or any DB UUIDs
 *  - AI output is Zod-validated before any business action is taken
 *  - Malformed AI output degrades to UNKNOWN intent (no crash, no action)
 *  - Prompt injection detected via sanitization before sending to AI
 *  - Appointment decisions are never made by the AI alone — all go through booking service
 */

import { z } from 'zod';
import { AiProviderFactory } from '../../ai-engine/services/ai-provider.factory';
import type { WhatsAppBookingService, WaExecutionContext } from './whatsapp-booking.service';
import type { WhatsAppConversationService } from './whatsapp-conversation.service';
import type { WhatsAppConversationContext, WhatsAppAiOutput, SafeWhatsAppIntegration } from '../interfaces/whatsapp.interfaces';
import {
  WHATSAPP_INTENT_BOOK_APPOINTMENT,
  WHATSAPP_INTENT_RESCHEDULE,
  WHATSAPP_INTENT_CANCEL,
  WHATSAPP_INTENT_CHECK_APPOINTMENT,
  WHATSAPP_INTENT_CHECK_AVAILABILITY,
  WHATSAPP_INTENT_CLINIC_INFO,
  WHATSAPP_INTENT_DOCTOR_INFO,
  WHATSAPP_INTENT_APPOINTMENT_TYPES,
  WHATSAPP_INTENT_HUMAN_HANDOFF,
  WHATSAPP_INTENT_EMERGENCY,
  WHATSAPP_INTENT_UNKNOWN,
  WHATSAPP_INTENTS,
  WHATSAPP_DEFAULT_BOOKING_HORIZON_DAYS,
} from '../constants/whatsapp.constants';

// Zod schema for AI output validation
const AiOutputSchema = z.object({
  intent: z.enum(WHATSAPP_INTENTS as unknown as [string, ...string[]]).default(WHATSAPP_INTENT_UNKNOWN),
  extractedEntities: z.object({
    date: z.string().optional(),
    time: z.string().optional(),
    appointmentType: z.string().optional(),
    doctorName: z.string().optional(),
    appointmentId: z.string().optional(),
    confirmationResponse: z.boolean().optional(),
  }).default({}),
  responseText: z.string().min(1).max(4000),
  requiresToolCall: z.string().optional(),
  toolArgs: z.record(z.unknown()).optional(),
});

// Basic prompt injection detection (supplement to existing AiEngineService detection)
const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?(previous|prior|above)\s+instructions?/i,
  /system\s*:\s*you\s+are/i,
  /\[SYSTEM\]/i,
  /\{\{.*?\}\}/,  // template injection
  /\$\{.*?\}/,    // JS template injection
];

export class WhatsAppAiOrchestratorService {
  constructor(
    private readonly aiProviderFactory: AiProviderFactory,
    private readonly bookingService: WhatsAppBookingService,
    private readonly conversationService: WhatsAppConversationService,
  ) {}

  /**
   * Process a patient message and return the bot reply.
   *
   * @param patientMessage  Raw text from patient (will be sanitized)
   * @param context         Validated server-side conversation context
   * @param integration     WhatsApp integration config (settings, greeting)
   * @param clinicInfo      Curated clinic info for AI
   * @param ctx             Execution context (tenantId, clinicId — NOT sent to AI)
   * @param conversationId  Used only for state updates (NOT sent to AI)
   */
  public async processMessage(
    patientMessage: string,
    context: WhatsAppConversationContext,
    integration: SafeWhatsAppIntegration,
    clinicInfo: Record<string, string>,
    ctx: WaExecutionContext,
    conversationId: string,
  ): Promise<string> {
    // 1. Sanitize patient input
    const sanitized = this.sanitizeInput(patientMessage);

    // 2. If human handoff is active, return handoff message (no AI call)
    if (context.handoffActive) {
      return "You've been connected to our team. A staff member will contact you shortly. " +
             `For urgent matters, please call ${integration.settings.emergencyPhone ?? 'the clinic directly'}.`;
    }

    // 3. If confirmation is pending, interpret as yes/no
    if (context.confirmationPending) {
      return this.handleConfirmation(sanitized, context, integration, ctx, conversationId);
    }

    // 4. Call AI for intent + entity extraction
    const aiOutput = await this.callAi(sanitized, context, integration, clinicInfo);

    // 5. Execute the intent
    return this.executeIntent(aiOutput, context, integration, ctx, conversationId);
  }

  // ---------------------------------------------------------------------------
  // Private: AI Call
  // ---------------------------------------------------------------------------

  private async callAi(
    sanitizedMessage: string,
    context: WhatsAppConversationContext,
    integration: SafeWhatsAppIntegration,
    clinicInfo: Record<string, string>,
  ): Promise<WhatsAppAiOutput> {
    const systemPrompt = this.buildSystemPrompt(integration, clinicInfo);
    const userPrompt = this.buildUserPrompt(sanitizedMessage, context);

    try {
      const provider = this.aiProviderFactory.getProvider('openai');
      const messages = [
        { role: 'system' as const, content: systemPrompt },
        { role: 'user' as const, content: userPrompt },
      ];
      const response = await provider.generateResponse(messages, [], {
        model: 'gpt-4o-mini',
        responseFormat: 'json',
      });

      const parsed = JSON.parse(response.content ?? '{}');
      const validated = AiOutputSchema.safeParse(parsed);

      if (!validated.success) {
        console.warn('[WhatsApp AI] Output validation failed:', validated.error.message);
        return this.unknownIntentResponse('I apologize, I didn\'t quite understand that. Could you please rephrase?');
      }

      return validated.data as WhatsAppAiOutput;
    } catch (err) {
      console.error('[WhatsApp AI] Provider call failed:', err instanceof Error ? err.message : String(err));
      return this.unknownIntentResponse('I\'m having a moment of technical difficulty. Please try again in a moment.');
    }
  }

  // ---------------------------------------------------------------------------
  // Private: Intent Execution
  // ---------------------------------------------------------------------------

  private async executeIntent(
    aiOutput: WhatsAppAiOutput,
    context: WhatsAppConversationContext,
    integration: SafeWhatsAppIntegration,
    ctx: WaExecutionContext,
    conversationId: string,
  ): Promise<string> {
    const { intent, extractedEntities } = aiOutput;

    switch (intent) {
      case WHATSAPP_INTENT_EMERGENCY:
        return this.handleEmergency(integration);

      case WHATSAPP_INTENT_HUMAN_HANDOFF:
        return this.handleHumanHandoff(context, integration, ctx, conversationId);

      case WHATSAPP_INTENT_CLINIC_INFO: {
        const info = await this.bookingService.getClinicInfo(ctx);
        return aiOutput.responseText || `Our clinic is ${info.name}. We're located at ${info.address}. You can reach us at ${info.phone}.`;
      }

      case WHATSAPP_INTENT_DOCTOR_INFO: {
        const doctors = await this.bookingService.listDoctors(ctx);
        if (doctors.length === 0) return 'I don\'t have doctor information available at this time. Please call the clinic directly.';
        const list = doctors.map((d) => `- ${d.name}${d.specialty ? ` (${d.specialty})` : ''}`).join('\n');
        return `Our doctors:\n${list}\n\nWould you like to book with any of them?`;
      }

      case WHATSAPP_INTENT_APPOINTMENT_TYPES: {
        const types = await this.bookingService.getAppointmentTypes(ctx, integration.settings.allowedAppointmentTypes);
        const list = types.map((t) => `- ${t.name} (${t.durationMinutes} min)`).join('\n');
        return `We offer the following appointment types:\n${list}\n\nWhich would you like to book?`;
      }

      case WHATSAPP_INTENT_CHECK_AVAILABILITY:
        return await this.handleCheckAvailability(extractedEntities, context, integration, ctx, conversationId);

      case WHATSAPP_INTENT_BOOK_APPOINTMENT:
        if (!integration.settings.bookingEnabled) {
          return 'Online booking is not available at this time. Please call the clinic to schedule your appointment.';
        }
        return await this.handleBookingFlow(extractedEntities, context, integration, ctx, conversationId);

      case WHATSAPP_INTENT_CHECK_APPOINTMENT:
        return await this.handleCheckAppointment(context, ctx);

      case WHATSAPP_INTENT_RESCHEDULE:
        if (!integration.settings.rescheduleEnabled) {
          return 'Rescheduling online is not available. Please call the clinic to reschedule.';
        }
        return await this.handleRescheduleFlow(extractedEntities, context, integration, ctx, conversationId);

      case WHATSAPP_INTENT_CANCEL:
        if (!integration.settings.cancelEnabled) {
          return 'Cancellations must be made by calling the clinic directly.';
        }
        return await this.handleCancelFlow(extractedEntities, context, integration, ctx, conversationId);

      default:
        return aiOutput.responseText || 'I\'m here to help with scheduling. Would you like to book, reschedule, or cancel an appointment?';
    }
  }

  // ---------------------------------------------------------------------------
  // Private: Intent Handlers
  // ---------------------------------------------------------------------------

  private handleEmergency(integration: SafeWhatsAppIntegration): string {
    const emergency = integration.settings.emergencyPhone;
    if (emergency) {
      return `🚨 For dental emergencies, please call us immediately at ${emergency}. We're here to help you.`;
    }
    return '🚨 For dental emergencies, please call the clinic immediately or visit the nearest emergency dental centre.';
  }

  private async handleHumanHandoff(
    context: WhatsAppConversationContext,
    integration: SafeWhatsAppIntegration,
    ctx: WaExecutionContext,
    conversationId: string,
  ): Promise<string> {
    await this.conversationService.escalateToHuman(conversationId, ctx.tenantId, 'Patient requested human agent', ctx.correlationId);
    return `I'll connect you with our team right away. A staff member will reach out to you shortly at ${ctx.patientPhone}. ` +
           `If you need immediate assistance, please call ${integration.settings.emergencyPhone ?? 'the clinic directly'}.`;
  }

  private async handleCheckAvailability(
    entities: WhatsAppAiOutput['extractedEntities'],
    context: WhatsAppConversationContext,
    integration: SafeWhatsAppIntegration,
    ctx: WaExecutionContext,
    conversationId: string,
  ): Promise<string> {
    const doctors = await this.bookingService.listDoctors(ctx);
    if (doctors.length === 0) return 'No doctors are currently available. Please contact the clinic directly.';

    // Parse date from entity (fallback to tomorrow)
    const date = this.parseDate(entities.date) ?? this.getNextBusinessDate();
    const doctor = doctors[0]!;
    const types = await this.bookingService.getAppointmentTypes(ctx, integration.settings.allowedAppointmentTypes);
    const duration = types[0]?.durationMinutes ?? 30;
    const timezone = (await this.bookingService.getClinicInfo(ctx)).timezone ?? 'UTC';

    try {
      const availability = await this.bookingService.checkAvailability(ctx, doctor.id, date, duration, timezone);
      if (availability.availableSlots.length === 0) {
        return `I'm sorry, Dr. ${availability.doctorName} has no availability on ${date}. Would you like to check a different date?`;
      }
      const slots = availability.availableSlots.slice(0, 5).map((s) => s.time).join(', ');
      return `Dr. ${availability.doctorName} is available on ${date} at: ${slots}.\n\nWould you like to book one of these slots?`;
    } catch (err) {
      return 'I wasn\'t able to check availability at this time. Please try again or call the clinic.';
    }
  }

  private async handleBookingFlow(
    entities: WhatsAppAiOutput['extractedEntities'],
    context: WhatsAppConversationContext,
    integration: SafeWhatsAppIntegration,
    ctx: WaExecutionContext,
    conversationId: string,
  ): Promise<string> {
    // Find or confirm patient
    let patient = await this.bookingService.findPatientByPhone(ctx);
    if (!patient) {
      // New patient — ask for name
      await this.conversationService.updateContext(conversationId, ctx.tenantId, {
        currentOperation: 'booking',
        intent: WHATSAPP_INTENT_BOOK_APPOINTMENT,
      }, ctx.correlationId);
      return 'I\'d love to help you book an appointment! I don\'t have your name on file yet. Could you please tell me your full name?';
    }

    // Have patient — check if we have enough info for a slot
    const date = this.parseDate(entities.date ?? context.date) ?? this.getNextBusinessDate();
    const types = await this.bookingService.getAppointmentTypes(ctx, integration.settings.allowedAppointmentTypes);
    const appointmentType = entities.appointmentType ?? context.appointmentType ?? types[0]?.name ?? 'checkup';
    const duration = types.find((t) => t.name === appointmentType)?.durationMinutes ?? 30;
    const timezone = (await this.bookingService.getClinicInfo(ctx)).timezone ?? 'UTC';

    // Find a doctor
    const doctors = await this.bookingService.listDoctors(ctx);
    if (doctors.length === 0) return 'No doctors are available at this time. Please contact the clinic directly.';

    let doctorId = context.doctorId;
    if (entities.doctorName && !doctorId) {
      const match = doctors.find((d) => d.name.toLowerCase().includes(entities.doctorName!.toLowerCase()));
      if (match) doctorId = match.id;
    }
    if (!doctorId) doctorId = doctors[0]!.id;

    try {
      const availability = await this.bookingService.checkAvailability(ctx, doctorId, date, duration, timezone);
      if (availability.availableSlots.length === 0) {
        return `I'm sorry, there are no available slots for a ${appointmentType} on ${date}. Would you like to try a different date?`;
      }

      // Find the requested time or use first available
      let selectedSlot = availability.availableSlots[0]!;
      if (entities.time) {
        const requested = entities.time.trim();
        const match = availability.availableSlots.find((s) => s.time === requested || s.time.startsWith(requested));
        if (match) selectedSlot = match;
      }

      // Store booking details and ask for confirmation
      await this.conversationService.updateContext(conversationId, ctx.tenantId, {
        currentOperation: 'booking',
        intent: WHATSAPP_INTENT_BOOK_APPOINTMENT,
        patientId: patient.id,
        patientName: patient.fullName,
        appointmentType,
        durationMinutes: duration,
        doctorId,
        doctorName: availability.doctorName,
        date,
        time: selectedSlot.time,
        selectedSlot: {
          startTimeIso: this.localSlotToUtcIso(date, selectedSlot.time, timezone),
          endTimeIso: this.localSlotToUtcIso(date, selectedSlot.endTime, timezone),
        },
        confirmationPending: true,
      }, ctx.correlationId);

      return `Great, ${patient.fullName}! I have the following slot available:\n\n` +
             `📅 ${date}\n⏰ ${selectedSlot.time} – ${selectedSlot.endTime}\n` +
             `👨‍⚕️ ${availability.doctorName}\n💉 ${appointmentType} (${duration} min)\n\n` +
             `Shall I confirm this booking? Reply *Yes* to confirm or *No* to choose a different time.`;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[WhatsApp] Booking flow error:', msg);
      return 'I encountered an issue while checking availability. Please try again or call the clinic.';
    }
  }

  private async handleConfirmation(
    message: string,
    context: WhatsAppConversationContext,
    integration: SafeWhatsAppIntegration,
    ctx: WaExecutionContext,
    conversationId: string,
  ): Promise<string> {
    const lower = message.toLowerCase().trim();
    const isYes = /^(yes|yeah|yep|confirm|ok|okay|sure|go ahead|book it|y|si|oui)/.test(lower);
    const isNo  = /^(no|nope|cancel|stop|dont|don't|n)/.test(lower);

    if (!isYes && !isNo) {
      return 'Sorry, I didn\'t catch that. Please reply *Yes* to confirm or *No* to cancel.';
    }

    if (isNo) {
      await this.conversationService.updateContext(conversationId, ctx.tenantId, {
        confirmationPending: false,
        currentOperation: null,
        selectedSlot: undefined,
      }, ctx.correlationId);
      return 'No problem! Would you like to choose a different time, or is there anything else I can help you with?';
    }

    // Yes — execute the pending operation
    if (context.currentOperation === 'booking' && context.selectedSlot && context.patientId && context.doctorId) {
      try {
        const timezone = (await this.bookingService.getClinicInfo(ctx)).timezone ?? 'UTC';
        const booking = await this.bookingService.bookAppointment(
          ctx,
          context.patientId,
          context.doctorId,
          context.selectedSlot.startTimeIso,
          context.selectedSlot.endTimeIso,
          context.appointmentType ?? 'checkup',
          context.durationMinutes ?? 30,
          timezone,
        );

        await this.conversationService.recordBooking(conversationId, ctx.tenantId, booking.appointmentId, ctx.correlationId);

        return `✅ Your appointment has been confirmed!\n\n` +
               `📅 ${context.date}\n⏰ ${context.time}\n` +
               `👨‍⚕️ ${context.doctorName}\n💉 ${context.appointmentType}\n\n` +
               `Your booking reference is *${booking.publicId}*. We'll see you then! ` +
               `Reply *menu* at any time to see what else I can help with.`;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes('conflict') || msg.includes('overlap')) {
          await this.conversationService.updateContext(conversationId, ctx.tenantId, {
            confirmationPending: false,
            selectedSlot: undefined,
          }, ctx.correlationId);
          return 'Unfortunately that slot was just taken by another patient. Would you like to see the next available times?';
        }
        console.error('[WhatsApp] Confirm booking error:', msg);
        return 'I wasn\'t able to complete your booking. Please try again or call the clinic.';
      }
    }

    // Gap 2 fix: reschedule confirmation was previously missing — always fell through to generic error.
    if (context.currentOperation === 'reschedule' && context.selectedSlot && context.existingAppointmentId) {
      try {
        const timezone = (await this.bookingService.getClinicInfo(ctx)).timezone ?? 'UTC';
        const booking = await this.bookingService.rescheduleAppointment(
          ctx,
          context.existingAppointmentId,
          context.selectedSlot.startTimeIso,
          context.selectedSlot.endTimeIso,
          timezone,
        );

        await this.conversationService.updateContext(conversationId, ctx.tenantId, {
          confirmationPending: false,
          currentOperation: null,
          existingAppointmentId: undefined,
          selectedSlot: undefined,
        }, ctx.correlationId);

        return `✅ Your appointment has been rescheduled!\n\n` +
               `📅 ${context.date}\n⏰ ${context.time}\n\n` +
               `Booking reference: *${booking.publicId}*. We'll see you then!`;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes('conflict') || msg.includes('overlap')) {
          await this.conversationService.updateContext(conversationId, ctx.tenantId, {
            confirmationPending: false,
            selectedSlot: undefined,
          }, ctx.correlationId);
          return 'Unfortunately that slot was just taken. Would you like to see other available times?';
        }
        console.error('[WhatsApp] Reschedule confirmation error:', msg);
        return 'I wasn\'t able to reschedule your appointment. Please call the clinic for assistance.';
      }
    }

    if (context.currentOperation === 'cancel' && context.existingAppointmentId) {
      try {
        await this.bookingService.cancelAppointment(ctx, context.existingAppointmentId, 'Cancelled via WhatsApp');
        await this.conversationService.updateContext(conversationId, ctx.tenantId, {
          confirmationPending: false,
          currentOperation: null,
          existingAppointmentId: undefined,
        }, ctx.correlationId);
        return '✅ Your appointment has been cancelled. Is there anything else I can help you with?';
      } catch (err) {
        console.error('[WhatsApp] Cancel confirmation error:', err);
        return 'I wasn\'t able to cancel your appointment. Please call the clinic for assistance.';
      }
    }

    return 'I\'m not sure what to confirm. Could you please start your request again?';
  }

  private async handleCheckAppointment(context: WhatsAppConversationContext, ctx: WaExecutionContext): Promise<string> {
    if (!context.patientId) {
      const patient = await this.bookingService.findPatientByPhone(ctx);
      if (!patient) return 'I don\'t have any appointment records for your number. Would you like to book one?';
      const appts = await this.bookingService.getPatientAppointments(ctx, patient.id);
      if (appts.length === 0) return 'You have no upcoming appointments. Would you like to book one?';
      const list = appts.slice(0, 3).map((a: any) =>
        `📅 ${new Date(a.startTime).toLocaleDateString()} at ${new Date(a.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} — ${a.appointmentType} (${a.status})`
      ).join('\n');
      return `Your upcoming appointments:\n\n${list}\n\nWould you like to reschedule or cancel any of these?`;
    }
    const appts = await this.bookingService.getPatientAppointments(ctx, context.patientId);
    if (appts.length === 0) return 'You have no upcoming appointments. Would you like to book one?';
    const list = appts.slice(0, 3).map((a: any) =>
      `📅 ${new Date(a.startTime).toLocaleDateString()} at ${new Date(a.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} — ${a.appointmentType} (${a.status})`
    ).join('\n');
    return `Your upcoming appointments:\n\n${list}\n\nWould you like to reschedule or cancel any of these?`;
  }

  private async handleRescheduleFlow(
    entities: WhatsAppAiOutput['extractedEntities'],
    context: WhatsAppConversationContext,
    integration: SafeWhatsAppIntegration,
    ctx: WaExecutionContext,
    conversationId: string,
  ): Promise<string> {
    const patient = await this.bookingService.findPatientByPhone(ctx);
    if (!patient) return 'I don\'t have any appointments on file for your number.';

    const appts = await this.bookingService.getPatientAppointments(ctx, patient.id);
    const scheduledAppts = appts.filter((a: any) => ['scheduled', 'confirmed', 'pending'].includes(a.status));

    if (scheduledAppts.length === 0) return 'You have no upcoming appointments that can be rescheduled.';

    // Take the most upcoming appointment
    const appt = scheduledAppts[0]!;
    const date = this.parseDate(entities.date ?? context.date) ?? this.getNextBusinessDate();
    const timezone = (await this.bookingService.getClinicInfo(ctx)).timezone ?? 'UTC';

    try {
      const availability = await this.bookingService.checkAvailability(
        ctx, appt.doctorId, date, appt.durationMinutes ?? 30, timezone, appt.id
      );

      if (availability.availableSlots.length === 0) {
        return `No availability found on ${date} for rescheduling. Would you like to try a different date?`;
      }

      let selectedSlot = availability.availableSlots[0]!;
      if (entities.time) {
        const match = availability.availableSlots.find((s) => s.time === entities.time || s.time.startsWith(entities.time!));
        if (match) selectedSlot = match;
      }

      await this.conversationService.updateContext(conversationId, ctx.tenantId, {
        currentOperation: 'reschedule',
        existingAppointmentId: appt.id,
        date,
        time: selectedSlot.time,
        selectedSlot: {
          startTimeIso: this.localSlotToUtcIso(date, selectedSlot.time, timezone),
          endTimeIso: this.localSlotToUtcIso(date, selectedSlot.endTime, timezone),
        },
        confirmationPending: true,
      }, ctx.correlationId);

      return `I'll reschedule your ${appt.appointmentType} appointment to:\n\n` +
             `📅 ${date}\n⏰ ${selectedSlot.time} – ${selectedSlot.endTime}\n\n` +
             `Reply *Yes* to confirm the reschedule or *No* to keep the existing time.`;
    } catch (err) {
      console.error('[WhatsApp] Reschedule flow error:', err);
      return 'I wasn\'t able to reschedule at this time. Please call the clinic for assistance.';
    }
  }

  private async handleCancelFlow(
    entities: WhatsAppAiOutput['extractedEntities'],
    context: WhatsAppConversationContext,
    integration: SafeWhatsAppIntegration,
    ctx: WaExecutionContext,
    conversationId: string,
  ): Promise<string> {
    const patient = await this.bookingService.findPatientByPhone(ctx);
    if (!patient) return 'I don\'t have any appointments on file for your number.';

    const appts = await this.bookingService.getPatientAppointments(ctx, patient.id);
    const scheduledAppts = appts.filter((a: any) => ['scheduled', 'confirmed', 'pending'].includes(a.status));

    if (scheduledAppts.length === 0) return 'You have no upcoming appointments to cancel.';

    const appt = scheduledAppts[0]!;
    const apptDate = new Date(appt.startTime).toLocaleDateString();
    const apptTime = new Date(appt.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    await this.conversationService.updateContext(conversationId, ctx.tenantId, {
      currentOperation: 'cancel',
      existingAppointmentId: appt.id,
      confirmationPending: true,
    }, ctx.correlationId);

    return `Are you sure you want to cancel your ${appt.appointmentType} appointment on ${apptDate} at ${apptTime}?\n\nReply *Yes* to cancel or *No* to keep it.`;
  }

  // ---------------------------------------------------------------------------
  // Private: Prompt Building
  // ---------------------------------------------------------------------------

  private buildSystemPrompt(integration: SafeWhatsAppIntegration, clinicInfo: Record<string, string>): string {
    return `You are ${integration.settings.personality || 'a dental receptionist'} for ${clinicInfo.name || 'the dental clinic'}.

ROLE: Administrative receptionist only. You help patients with:
- Booking, rescheduling, and cancelling appointments
- Checking appointment availability
- Providing clinic information
- Answering general questions about services

STRICT PROHIBITIONS (must refuse immediately):
- Never provide medical advice, diagnosis, or treatment recommendations
- Never interpret test results or discuss medications
- Never provide specific dental procedures without a consultation
- For any dental emergency, immediately direct to emergency phone or 911

RESPONSE FORMAT: Always respond with a JSON object:
{
  "intent": "<one of: ${WHATSAPP_INTENTS.join(', ')}>",
  "extractedEntities": {
    "date": "<YYYY-MM-DD or natural language date>",
    "time": "<HH:MM in 24h format>",
    "appointmentType": "<appointment type name>",
    "doctorName": "<doctor name if mentioned>",
    "confirmationResponse": <true for yes, false for no, omit if unclear>
  },
  "responseText": "<your friendly response to the patient>",
  "requiresToolCall": "<optional tool name if needed>"
}

IMPORTANT:
- Be concise and friendly
- Today's date for context: ${new Date().toISOString().split('T')[0]}
- Clinic timezone: ${clinicInfo.timezone}
- When in doubt, use intent UNKNOWN and ask for clarification`;
  }

  private buildUserPrompt(message: string, context: WhatsAppConversationContext): string {
    const contextSummary = [];
    if (context.currentOperation) contextSummary.push(`Current operation: ${context.currentOperation}`);
    if (context.appointmentType) contextSummary.push(`Discussing: ${context.appointmentType}`);
    if (context.date) contextSummary.push(`Date mentioned: ${context.date}`);
    if (context.confirmationPending) contextSummary.push('Waiting for confirmation (yes/no)');

    const ctx = contextSummary.length > 0 ? `\nCONTEXT: ${contextSummary.join('; ')}\n` : '';
    return `${ctx}PATIENT MESSAGE: ${message}`;
  }

  // ---------------------------------------------------------------------------
  // Private: Utility
  // ---------------------------------------------------------------------------

  private sanitizeInput(message: string): string {
    let sanitized = message.trim().slice(0, 500);
    for (const pattern of INJECTION_PATTERNS) {
      sanitized = sanitized.replace(pattern, '[filtered]');
    }
    return sanitized;
  }

  private parseDate(dateStr?: string): string | null {
    if (!dateStr) return null;
    // If already YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
    // Try to parse natural language via Date constructor (limited but safe)
    const parsed = new Date(dateStr);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString().split('T')[0]!;
    }
    return null;
  }

  private getNextBusinessDate(): string {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    // If tomorrow is Sunday, skip to Monday
    if (d.getDay() === 0) d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0]!;
  }

  /**
   * Gap 6 fix: Convert a local date+time pair in a given IANA timezone to a UTC ISO-8601 string.
   *
   * Previously slots were stored as `${date}T${slotTime}:00` with no TZ suffix, causing
   * AppointmentService.createAppointment to interpret them as UTC even in non-UTC clinics.
   *
   * Strategy:
   *  1. Build a test Date at midnight UTC on the target date.
   *  2. Use Intl.DateTimeFormat to find what local time that UTC midnight maps to.
   *  3. Compute the offset (localTime - UTCmidnight) in minutes.
   *  4. Subtract that offset from the desired local slot time to get UTC.
   *
   * Falls back to bare ISO (no offset) if the timezone is unrecognised.
   */
  private localSlotToUtcIso(date: string, localTime: string, timezone: string): string {
    try {
      // Parse local HH:MM
      const [hStr, mStr] = localTime.split(':');
      const localHour = parseInt(hStr ?? '0', 10);
      const localMinute = parseInt(mStr ?? '0', 10);
      const localTotalMinutes = localHour * 60 + localMinute;

      // Use Intl to get the wall-clock time at midnight UTC on target date in the clinic TZ
      const midnightUtc = new Date(`${date}T00:00:00.000Z`);
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });
      const parts = formatter.formatToParts(midnightUtc);
      let tzHour = 0;
      let tzMinute = 0;
      for (const part of parts) {
        if (part.type === 'hour')   tzHour   = parseInt(part.value, 10) % 24;
        if (part.type === 'minute') tzMinute = parseInt(part.value, 10);
      }
      // Offset = local time of UTC midnight in the target TZ (i.e. how far ahead/behind UTC)
      const offsetMinutes = tzHour * 60 + tzMinute;

      // UTC equivalent of the local slot = localSlot - offset
      const utcTotalMinutes = localTotalMinutes - offsetMinutes;
      const utcDate = new Date(midnightUtc.getTime() + utcTotalMinutes * 60 * 1000);
      return utcDate.toISOString();
    } catch {
      // Fallback: return bare local ISO (pre-existing behaviour) — better than throwing
      return `${date}T${localTime}:00.000Z`;
    }
  }

  private unknownIntentResponse(text: string): WhatsAppAiOutput {
    return {
      intent: WHATSAPP_INTENT_UNKNOWN,
      extractedEntities: {},
      responseText: text,
    };
  }
}

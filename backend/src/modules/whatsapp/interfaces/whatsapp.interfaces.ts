/**
 * WhatsApp Module Interfaces
 *
 * All shared types, DTOs, and service contracts for the WhatsApp channel.
 * Never includes secrets, raw DB schema, or internal IDs directly visible to AI.
 */

import type { WhatsAppIntent, WhatsAppJobType } from '../constants/whatsapp.constants';

// ---------------------------------------------------------------------------
// Meta Provider Webhook Payload Types (normalized from raw Meta format)
// ---------------------------------------------------------------------------

export interface MetaInboundMessage {
  wamid: string;            // Meta message ID (providerMessageId)
  from: string;             // E.164 sender phone
  to: string;               // E.164 destination phone (our registered number)
  timestamp: string;        // Unix timestamp string from Meta
  type: string;             // 'text' | 'image' | 'audio' | 'interactive' | 'sticker' | etc.
  text?: string;            // Extracted plain text (if type='text')
  rawPayload: Record<string, unknown>; // Full normalized payload for storage
}

export interface MetaStatusUpdate {
  wamid: string;
  to: string;
  status: string;           // 'sent' | 'delivered' | 'read' | 'failed'
  timestamp: string;
}

// ---------------------------------------------------------------------------
// WhatsApp Integration Settings (stored in WhatsAppIntegration.settings JSON)
// ---------------------------------------------------------------------------

export interface WhatsAppIntegrationSettings {
  greeting: string;
  personality: string;        // Brief AI persona description
  bookingEnabled: boolean;
  rescheduleEnabled: boolean;
  cancelEnabled: boolean;
  allowedAppointmentTypes: string[];  // Empty = all types from config
  bookingHorizonDays: number;
  minNoticePeriodHours: number;
  handoffEnabled: boolean;
  handoffKeywords: string[];  // e.g. ['human', 'agent', 'speak to someone']
  emergencyPhone?: string;    // Clinic emergency contact number
}

export const DEFAULT_WHATSAPP_SETTINGS: WhatsAppIntegrationSettings = {
  greeting: "Hello! I'm your dental clinic assistant. How can I help you today?",
  personality: 'Friendly dental receptionist',
  bookingEnabled: true,
  rescheduleEnabled: true,
  cancelEnabled: true,
  allowedAppointmentTypes: [],
  bookingHorizonDays: 30,
  minNoticePeriodHours: 2,
  handoffEnabled: true,
  handoffKeywords: ['human', 'agent', 'speak to someone', 'call me', 'receptionist'],
  emergencyPhone: undefined,
};

// ---------------------------------------------------------------------------
// Safe Integration View (never includes secrets/tokens)
// ---------------------------------------------------------------------------

export interface SafeWhatsAppIntegration {
  id: string;
  publicId: string;
  tenantId: string;
  clinicId: string;
  phoneNumber: string;     // E.164
  phoneNumberId: string;   // Meta ID
  wabaId: string;
  displayName: string;
  status: string;
  isEnabled: boolean;
  settings: WhatsAppIntegrationSettings;
  createdAt: Date;
  updatedAt: Date;
}

// ---------------------------------------------------------------------------
// WhatsApp Conversation Context (stored in Conversation.metadata.whatsapp)
// ---------------------------------------------------------------------------

export interface WhatsAppConversationContext {
  intent: WhatsAppIntent | null;
  patientId?: string;
  patientName?: string;
  patientPhone: string;            // E.164, immutable for the session

  // Booking slot under construction
  appointmentType?: string;
  doctorId?: string;
  doctorName?: string;
  date?: string;                   // YYYY-MM-DD in clinic timezone
  time?: string;                   // HH:mm in clinic timezone
  durationMinutes?: number;
  selectedSlot?: {
    startTimeIso: string;          // ISO-8601 UTC
    endTimeIso: string;
  };

  // Operation tracking
  confirmationPending: boolean;
  currentOperation?: 'booking' | 'reschedule' | 'cancel' | 'inquiry' | null;
  existingAppointmentId?: string;  // For reschedule/cancel operations

  // Human handoff
  handoffActive: boolean;
  handoffReason?: string;
  handoffRequestedAt?: string;     // ISO-8601

  // Session metadata
  lastMessageAt: string;           // ISO-8601
  turnCount: number;
  rateLimitWindowStart?: string;   // ISO-8601
  messagesInWindow?: number;
}

// ---------------------------------------------------------------------------
// AI Orchestrator Output (Zod-validated server-side before any action)
// ---------------------------------------------------------------------------

export interface WhatsAppAiExtractedEntities {
  date?: string;            // Natural language date extracted by AI
  time?: string;            // Natural language time extracted by AI
  appointmentType?: string;
  doctorName?: string;
  appointmentId?: string;
  confirmationResponse?: boolean;  // true = 'yes', false = 'no', undefined = unclear
}

export interface WhatsAppAiOutput {
  intent: WhatsAppIntent;
  extractedEntities: WhatsAppAiExtractedEntities;
  responseText: string;           // Message to send to patient
  requiresToolCall?: string;      // Tool ID to invoke next (if any)
  toolArgs?: Record<string, unknown>; // Suggested tool args (validated before use)
}

// ---------------------------------------------------------------------------
// WhatsApp Job Payload (stored in WhatsAppJob.payload)
// ---------------------------------------------------------------------------

export interface WhatsAppInboundJobPayload {
  integrationId: string;
  messageId: string;              // WhatsAppMessage.id
  wamid: string;
  fromPhone: string;              // E.164 patient phone
  toPhone: string;                // E.164 our number
  messageType: string;
  textContent?: string;
  timestamp: string;
  correlationId: string;
}

export interface WhatsAppOutboundJobPayload {
  integrationId: string;
  toPhone: string;                // E.164 patient phone
  fromPhone: string;              // E.164 our number
  phoneNumberId: string;          // Meta phone number ID for sending
  messageText: string;
  conversationId?: string;
  correlationId: string;
}

// ---------------------------------------------------------------------------
// Provider Result
// ---------------------------------------------------------------------------

export interface ProviderSendResult {
  success: boolean;
  providerMessageId?: string;     // Meta wamid returned after send
  error?: string;
}

// ---------------------------------------------------------------------------
// Service Param Interfaces
// ---------------------------------------------------------------------------

export interface CreateWhatsAppIntegrationParams {
  tenantId: string;
  clinicId: string;
  phoneNumber: string;
  phoneNumberId: string;
  wabaId: string;
  displayName: string;
  webhookVerifyToken: string;
  settings?: Partial<WhatsAppIntegrationSettings>;
  actorId: string;
  requestId: string;
}

export interface UpdateWhatsAppIntegrationParams {
  id: string;
  tenantId: string;
  clinicId: string;
  displayName?: string;
  isEnabled?: boolean;
  settings?: Partial<WhatsAppIntegrationSettings>;
  actorId: string;
  requestId: string;
}

export interface EnqueueJobParams {
  idempotencyKey: string;
  tenantId: string;
  clinicId: string;
  integrationId: string;
  conversationId?: string;
  jobType: WhatsAppJobType;
  payload: Record<string, unknown>;
  providerMessageId?: string;
  correlationId?: string;
}

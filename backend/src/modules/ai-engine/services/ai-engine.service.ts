/**
 * AI Engine Service
 *
 * Coordinates the full AI session lifecycle.
 */

import type {
  IAiEngineService,
  IAiProvider,
  IAiAuditLogRepository,
  IAiEngineEventPublisher,
} from '../interfaces/ai-engine.interfaces';
import type { IConversationService } from '../../conversation/interfaces/conversation.interfaces';
import type { IConfigurationService } from '../../configuration/interfaces/configuration.interfaces';
import type {
  AiMessage,
  AiToolDefinition,
  AiProviderResponse,
  AiParseResult,
  StructuredAiResponse,
} from '../types/ai-engine.types';
import { AiProviderFactory } from './ai-provider.factory';
import {
  PromptInjectionDetectedError,
  LowConfidenceError,
} from '../errors/ai-engine.errors';
import {
  DEFAULT_AI_PROVIDER,
  DEFAULT_AI_MODEL,
  DEFAULT_CONFIDENCE_THRESHOLD,
  DEFAULT_MAX_RETRIES,
  DEFAULT_RETRY_DELAY_MS,
  EVENT_AI_SESSION_STARTED,
  EVENT_AI_SESSION_COMPLETED,
  EVENT_AI_PROMPT_VERSION_USED,
  EVENT_AI_PROVIDER_CHANGED,
  EVENT_AI_FALLBACK_TRIGGERED,
  EVENT_AI_TOOL_REQUEST_GENERATED,
  SUPPORTED_INTENTS,
} from '../constants/ai-engine.constants';

export class AiEngineService implements IAiEngineService {
  constructor(
    private readonly conversationService: IConversationService,
    private readonly configurationService: IConfigurationService,
    private readonly providerFactory: AiProviderFactory,
    private readonly auditLogRepository: IAiAuditLogRepository,
    private readonly publisher: IAiEngineEventPublisher,
  ) {}

  // -------------------------------------------------------------------------
  // Core Chat Orchestration
  // -------------------------------------------------------------------------

  public async chat(params: {
    tenantId: string;
    clinicId: string | null;
    conversationId: string;
    message: string;
    actorId: string;
    requestId: string;
  }): Promise<StructuredAiResponse> {
    const { tenantId, clinicId, conversationId, message, actorId, requestId } = params;

    // 1. Prompt Injection check
    if (this.detectPromptInjection(message)) {
      await this.logAudit({
        tenantId,
        clinicId,
        conversationId,
        provider: 'security_shield',
        eventType: 'prompt_injection_detected',
        requestId,
        metadata: { input: message },
      });
      throw new PromptInjectionDetectedError();
    }

    // 2. Fetch Conversation & Configuration
    const conversation = await this.conversationService.getConversationById(conversationId, tenantId);
    const config = await this.configurationService.getActiveConfiguration(tenantId, clinicId);

    // Track active provider & model
    const providerName = (config.ai?.provider as string) || DEFAULT_AI_PROVIDER;
    const modelName = (config.ai?.model as string) || DEFAULT_AI_MODEL;
    const apiKey = (config.providers?.openai as Record<string, any>)?.apiKey as string | undefined;

    // Log AI Session Started
    await this.logAudit({
      tenantId,
      clinicId,
      conversationId,
      provider: providerName,
      eventType: EVENT_AI_SESSION_STARTED,
      requestId,
    });
    await this.publisher.publish({
      type: EVENT_AI_SESSION_STARTED,
      payload: {
        tenantId,
        clinicId,
        conversationId,
        provider: providerName,
        requestId,
        occurredAt: new Date(),
      },
    });

    // Log configuration prompt version
    await this.logAudit({
      tenantId,
      clinicId,
      conversationId,
      provider: providerName,
      eventType: EVENT_AI_PROMPT_VERSION_USED,
      requestId,
      metadata: { version: config.version },
    });
    await this.publisher.publish({
      type: EVENT_AI_PROMPT_VERSION_USED,
      payload: {
        tenantId,
        clinicId,
        conversationId,
        promptVersion: config.version,
        requestId,
        occurredAt: new Date(),
      },
    });

    // 3. Build Conversation History
    const history: AiMessage[] = [];

    // System instruction prompt
    const systemPrompt = this.buildSystemPrompt(config);
    history.push({ role: 'system', content: systemPrompt });

    // Load past turns
    for (const turn of conversation.transcript) {
      history.push({
        role: turn.speaker === 'patient' || turn.speaker === 'caller' ? 'user' : 'assistant',
        content: turn.message,
      });
    }

    // Append new user turn
    history.push({ role: 'user', content: message });

    // 4. Instantiation of Provider
    const provider = this.providerFactory.getProvider(providerName, apiKey);
    const tools = this.getToolDefinitions();

    let loopCount = 0;
    const maxLoops = 3;
    let providerResponse: AiProviderResponse | null = null;
    let totalInputTokens = 0;
    let totalOutputTokens = 0;

    // Loop executing read-only tools
    while (loopCount < maxLoops) {
      loopCount++;

      // Provider call with retry handler
      providerResponse = await this.executeWithRetry(() =>
        provider.generateResponse(history, tools, {
          model: modelName,
          temperature: 0.2, // low temperature for deterministic parsing
          responseFormat: 'json',
        })
      );

      totalInputTokens += providerResponse.usage.inputTokens;
      totalOutputTokens += providerResponse.usage.outputTokens;

      // Handle tool calls
      if (providerResponse.toolCalls && providerResponse.toolCalls.length > 0) {
        let hasLocalTool = false;

        // Push assistant response to history
        history.push({
          role: 'assistant',
          content: providerResponse.content,
          toolCalls: providerResponse.toolCalls,
        });

        for (const tc of providerResponse.toolCalls) {
          // Log tool request generation
          await this.logAudit({
            tenantId,
            clinicId,
            conversationId,
            provider: providerName,
            eventType: EVENT_AI_TOOL_REQUEST_GENERATED,
            requestId,
            metadata: { toolName: tc.name, toolCallId: tc.id },
          });
          await this.publisher.publish({
            type: EVENT_AI_TOOL_REQUEST_GENERATED,
            payload: {
              tenantId,
              clinicId,
              conversationId,
              toolName: tc.name,
              requestId,
              occurredAt: new Date(),
            },
          });

          // Attempt local read-only resolution
          if (this.isLocalTool(tc.name)) {
            hasLocalTool = true;
            let output: string;
            try {
              const args = JSON.parse(tc.arguments);
              output = await this.executeToolLocally(tc.name, args, config);
            } catch (err: any) {
              output = JSON.stringify({ error: err.message });
            }

            history.push({
              role: 'tool',
              content: output,
              toolCallId: tc.id,
              name: tc.name,
            });
          }
        }

        // If local tools were resolved, loop again to feed output back to LLM
        if (hasLocalTool) {
          continue;
        }
      }

      break;
    }

    if (!providerResponse) {
      throw new Error('AI Provider returned no response.');
    }

    // 5. Parse output to structured response
    const rawContent = providerResponse.content || '';
    const structuredResult = this.parseResponseContent(rawContent, providerResponse.toolCalls);

    // Enforce confidence scoring threshold
    const confidenceThreshold = (config.ai?.confidenceThreshold as number) ?? DEFAULT_CONFIDENCE_THRESHOLD;
    if (structuredResult.confidence < confidenceThreshold) {
      await this.logAudit({
        tenantId,
        clinicId,
        conversationId,
        provider: providerName,
        eventType: 'low_confidence_fallback',
        requestId,
        metadata: {
          intent: structuredResult.intent,
          confidence: structuredResult.confidence,
          threshold: confidenceThreshold,
        },
      });
      throw new LowConfidenceError(
        structuredResult.intent,
        structuredResult.confidence,
        confidenceThreshold
      );
    }

    // 6. Update database records via ConversationService
    const totalTokens = totalInputTokens + totalOutputTokens;
    const costUsd = this.calculateCost(providerResponse.model, totalInputTokens, totalOutputTokens);

    // Save transcript turns
    const userTurn = {
      sequence: conversation.transcript.length,
      speaker: 'patient',
      message,
      timestamp: new Date().toISOString(),
    };
    const assistantTurn = {
      sequence: conversation.transcript.length + 1,
      speaker: 'ai',
      message: structuredResult.reply,
      timestamp: new Date().toISOString(),
    };
    const updatedTurns = [...conversation.transcript, userTurn, assistantTurn];

    await this.conversationService.updateTranscript({
      id: conversationId,
      tenantId,
      turns: updatedTurns,
      actorId,
      requestId,
    });

    await this.conversationService.updateConversation({
      id: conversationId,
      tenantId,
      intent: structuredResult.intent,
      extractedEntities: {
        ...(conversation.extractedEntities || {}),
        ...structuredResult.entities,
      },
      inputTokens: (conversation.inputTokens || 0) + totalInputTokens,
      outputTokens: (conversation.outputTokens || 0) + totalOutputTokens,
      totalTokens: (conversation.totalTokens || 0) + totalTokens,
      estimatedCostUsd: (Number(conversation.estimatedCostUsd || 0) + Number(costUsd)).toFixed(6),
      aiModel: providerResponse.model,
      aiProvider: providerResponse.provider,
      actorId,
      requestId,
    });

    // Log AI Session Completed
    await this.logAudit({
      tenantId,
      clinicId,
      conversationId,
      provider: providerName,
      eventType: EVENT_AI_SESSION_COMPLETED,
      requestId,
      metadata: {
        inputTokens: totalInputTokens,
        outputTokens: totalOutputTokens,
        totalTokens,
        estimatedCostUsd: costUsd,
      },
    });
    await this.publisher.publish({
      type: EVENT_AI_SESSION_COMPLETED,
      payload: {
        tenantId,
        clinicId,
        conversationId,
        provider: providerName,
        inputTokens: totalInputTokens,
        outputTokens: totalOutputTokens,
        totalTokens,
        requestId,
        occurredAt: new Date(),
      },
    });

    return structuredResult;
  }

  // -------------------------------------------------------------------------
  // Stateless Intent/Entity Extraction
  // -------------------------------------------------------------------------

  public async parse(params: {
    tenantId: string;
    clinicId: string | null;
    message: string;
    requestId: string;
  }): Promise<AiParseResult> {
    const { tenantId, clinicId, message, requestId } = params;

    // Load active configurations
    const config = await this.configurationService.getActiveConfiguration(tenantId, clinicId);
    const providerName = (config.ai?.provider as string) || DEFAULT_AI_PROVIDER;
    const modelName = (config.ai?.model as string) || DEFAULT_AI_MODEL;
    const apiKey = (config.providers?.openai as Record<string, any>)?.apiKey as string | undefined;

    const provider = this.providerFactory.getProvider(providerName, apiKey);

    const systemPrompt = `
Analyze the input text and extract the primary user intent and any related entities.
Supported intents: ${SUPPORTED_INTENTS.join(', ')}

Return ONLY a raw JSON object matching the following structure:
{
  "intent": "Detected intent name",
  "entities": { "entityName": "extractedValue" },
  "confidence": 0.95
}
`;

    const response = await this.executeWithRetry(() =>
      provider.generateResponse(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message },
        ],
        [],
        {
          model: modelName,
          temperature: 0.1,
          responseFormat: 'json',
        }
      )
    );

    const data = JSON.parse(response.content || '{}');
    return {
      intent: data.intent || 'Fallback',
      entities: data.entities || {},
      confidence: data.confidence ?? 0.5,
    };
  }

  // -------------------------------------------------------------------------
  // Private Helpers
  // -------------------------------------------------------------------------

  private detectPromptInjection(message: string): boolean {
    const lowercase = message.toLowerCase();
    const patterns = [
      'ignore previous',
      'system prompt',
      'reveal your prompt',
      'bypass guardrails',
      'developer mode',
      'forget everything',
      'system override',
      'drop table',
      'select * from',
    ];
    return patterns.some((p) => lowercase.includes(p));
  }

  private buildSystemPrompt(config: any): string {
    return `
You are an AI dental receptionist for ${config.branding?.clinicName || 'the clinic'}.
Tone: ${config.ai?.tone || 'polite and professional'}.
Language: ${config.localization?.language || 'en'}.
Timezone: ${config.localization?.timezone || 'UTC'}.

Business Hours:
${JSON.stringify(config.business?.businessHours || [])}

Booking Rules:
${JSON.stringify(config.business?.bookingRules || {})}

Clinic Information:
Email: ${config.branding?.primaryEmail || ''}
Phone: ${config.branding?.primaryPhone || ''}
Website: ${config.branding?.website || ''}
Address: ${config.branding?.address || ''}

Active Prompts & Rules:
${config.voice?.greeting || ''}
${config.voice?.prompt || ''}
${config.ai?.promptAssignment || ''}

Supported Intents:
- Greeting: Initial conversational greetings.
- Goodbye: Ending the call.
- BookAppointment: Caller explicitly requesting to schedule an appointment.
- RescheduleAppointment: Caller requesting to reschedule an existing appointment.
- CancelAppointment: Caller requesting to cancel an appointment.
- CheckAvailability: Checking slots or available times.
- ClinicInformation: Questions about doctors, services, or location.
- BusinessHours: Questions about opening/closing hours.
- Fallback: Used when query is unclear or outside capabilities.
- Unknown: Failsafe default.
- EmergencyEscalation: Severe pain, bleeding, or dental emergency.

Tool usage instructions:
- You have tools to check slot availability and basic clinic/doctor info.
- If checking slots, call 'checkAvailability'.
- If checking hours, call 'getClinicInformation'.
- For state changes (booking, cancelling, rescheduling), do NOT pretend the action is fully complete. Generate the corresponding tool call (e.g. 'bookAppointment') and explain to the caller that you are processing their request.

Return your response in standard JSON format containing:
{
  "reply": "Conversational natural language text response to say to patient",
  "intent": "Intent string matching one of the supported intents",
  "entities": { "extractedKey": "extractedValue" },
  "confidence": 0.95
}
`;
  }

  private getToolDefinitions(): AiToolDefinition[] {
    return [
      {
        name: 'bookAppointment',
        description: 'Request booking of a dental appointment for a patient.',
        parameters: {
          type: 'object',
          properties: {
            patientName: { type: 'string', description: 'Full name of the patient' },
            phone: { type: 'string', description: 'Patient phone number in E.164' },
            doctorName: { type: 'string', description: 'Preferred doctor full name' },
            date: { type: 'string', description: 'Desired booking date (YYYY-MM-DD)' },
            time: { type: 'string', description: 'Desired booking time (HH:MM)' },
            reason: { type: 'string', description: 'Reason for dental visit' },
          },
          required: ['phone', 'date', 'time'],
        },
      },
      {
        name: 'cancelAppointment',
        description: 'Request cancellation of an appointment.',
        parameters: {
          type: 'object',
          properties: {
            phone: { type: 'string', description: 'Patient phone number' },
            appointmentId: { type: 'string', description: 'UUID of the appointment' },
            reason: { type: 'string', description: 'Reason for cancellation' },
          },
          required: ['phone'],
        },
      },
      {
        name: 'rescheduleAppointment',
        description: 'Request rescheduling of an appointment to a new date and time.',
        parameters: {
          type: 'object',
          properties: {
            phone: { type: 'string', description: 'Patient phone number' },
            appointmentId: { type: 'string', description: 'UUID of the appointment' },
            newDate: { type: 'string', description: 'New booking date (YYYY-MM-DD)' },
            newTime: { type: 'string', description: 'New booking time (HH:MM)' },
          },
          required: ['phone', 'newDate', 'newTime'],
        },
      },
      {
        name: 'checkAvailability',
        description: 'Check available slots for appointments.',
        parameters: {
          type: 'object',
          properties: {
            date: { type: 'string', description: 'Date to check availability (YYYY-MM-DD)' },
            doctorName: { type: 'string', description: 'Optional doctor name filter' },
          },
          required: ['date'],
        },
      },
      {
        name: 'getClinicInformation',
        description: 'Retrieve general clinic information, including operational hours.',
        parameters: {
          type: 'object',
          properties: {},
        },
      },
    ];
  }

  private isLocalTool(name: string): boolean {
    // Only read-only tools can be resolved locally by the AI Engine
    return ['getClinicInformation', 'checkAvailability'].includes(name);
  }

  private async executeToolLocally(
    name: string,
    args: Record<string, any>,
    config: any,
  ): Promise<string> {
    switch (name) {
      case 'getClinicInformation':
        return JSON.stringify({
          clinicName: config.branding?.clinicName,
          businessHours: config.business?.businessHours,
          primaryPhone: config.branding?.primaryPhone,
          primaryEmail: config.branding?.primaryEmail,
          address: config.branding?.address,
        });
      case 'checkAvailability':
        // Return simulated availability check outputs (actual DB check done by caller)
        return JSON.stringify({
          status: 'available',
          date: args.date,
          slots: ['09:00', '10:00', '11:00', '14:00', '15:00'],
        });
      default:
        return JSON.stringify({ error: `Tool ${name} cannot be executed locally.` });
    }
  }

  private parseResponseContent(content: string, toolCalls?: any[]): StructuredAiResponse {
    let cleanText = content.trim();

    // Strip markdown code fences if present
    if (cleanText.startsWith('```json')) {
      cleanText = cleanText.substring(7);
    }
    if (cleanText.startsWith('```')) {
      cleanText = cleanText.substring(3);
    }
    if (cleanText.endsWith('```')) {
      cleanText = cleanText.substring(0, cleanText.length - 3);
    }
    cleanText = cleanText.trim();

    try {
      const parsed = JSON.parse(cleanText);
      const toolRequests = toolCalls?.map((tc) => ({
        id: tc.id,
        name: tc.name,
        arguments: JSON.parse(tc.arguments),
      })) || parsed.toolRequests || [];

      return {
        reply: parsed.reply || 'Sorry, can you repeat that?',
        intent: parsed.intent || 'Fallback',
        entities: parsed.entities || {},
        confidence: parsed.confidence ?? 0.8,
        toolRequests,
      };
    } catch {
      // Fallback in case of raw non-JSON text
      const toolRequests = toolCalls?.map((tc) => ({
        id: tc.id,
        name: tc.name,
        arguments: JSON.parse(tc.arguments),
      })) || [];

      return {
        reply: content,
        intent: 'Fallback',
        entities: {},
        confidence: 0.5,
        toolRequests,
      };
    }
  }

  private calculateCost(model: string, inputTokens: number, outputTokens: number): string {
    let inputRate = 0.15 / 1000000;
    let outputRate = 0.6 / 1000000;

    if (model.includes('gpt-4o') && !model.includes('mini')) {
      inputRate = 5.0 / 1000000;
      outputRate = 15.0 / 1000000;
    }

    const cost = inputTokens * inputRate + outputTokens * outputRate;
    return cost.toFixed(6);
  }

  private async executeWithRetry<T>(
    fn: () => Promise<T>,
    retries = DEFAULT_MAX_RETRIES,
    delay = DEFAULT_RETRY_DELAY_MS,
  ): Promise<T> {
    try {
      return await fn();
    } catch (err: any) {
      if (retries <= 1) {
        throw err;
      }
      await new Promise((resolve) => setTimeout(resolve, delay));
      return this.executeWithRetry(fn, retries - 1, delay * 2);
    }
  }

  private async logAudit(data: {
    tenantId: string;
    clinicId: string | null;
    conversationId: string;
    provider: string;
    eventType: string;
    requestId: string | null;
    metadata?: Record<string, any>;
  }): Promise<void> {
    try {
      await this.auditLogRepository.create(data);
    } catch (err) {
      console.error('Failed to save AI audit log:', err);
    }
  }
}

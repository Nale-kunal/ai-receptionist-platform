/**
 * OpenAI Realtime Provider — Event Router
 *
 * Receives raw OpenAI WebSocket events and dispatches them to the
 * appropriate handler. Emits NormalizedRealtimeEvent for each handled event.
 *
 * This is the internal normalization boundary. Nothing above this class
 * sees raw OpenAI protocol types.
 */

import type { IOpenAiEventRouter, NormalizedRealtimeEvent } from './openai-realtime.interfaces';
import { OpenAiTranscriptHandler } from './openai-realtime.transcript.handler';
import { OpenAiToolHandler } from './openai-realtime.tool.handler';
import { OpenAiInterruptionHandler } from './openai-realtime.interruption.handler';
import { OpenAiResponseHandler } from './openai-realtime.response.handler';
import { validateRawEvent } from './openai-realtime.validators';
import {
  OPENAI_EVENT_ERROR,
  OPENAI_EVENT_SESSION_CREATED,
  OPENAI_EVENT_SESSION_UPDATED,
  OPENAI_EVENT_RESPONSE_DONE,
  OPENAI_EVENT_RESPONSE_AUDIO_DELTA,
} from './openai-realtime.constants';
import { OpenAiApiError } from './openai-realtime.errors';

export class OpenAiRealtimeEventRouter implements IOpenAiEventRouter {
  private readonly transcriptHandler = new OpenAiTranscriptHandler();
  private readonly interruptionHandler = new OpenAiInterruptionHandler();
  private readonly toolHandlers = new Map<string, OpenAiToolHandler>();
  private readonly responseHandlers = new Map<string, OpenAiResponseHandler>();

  constructor(
    private readonly responseHandlerFactory: (sessionId: string) => OpenAiResponseHandler,
  ) {}

  // ---------------------------------------------------------------------------
  // Session Management
  // ---------------------------------------------------------------------------

  public registerSession(sessionId: string): void {
    this.toolHandlers.set(sessionId, new OpenAiToolHandler());
    // Response handler is created on first use via factory
  }

  public unregisterSession(sessionId: string): void {
    this.toolHandlers.get(sessionId)?.clearSession(sessionId);
    this.toolHandlers.delete(sessionId);
    this.responseHandlers.delete(sessionId);
  }

  // ---------------------------------------------------------------------------
  // Main Router
  // ---------------------------------------------------------------------------

  public async route(
    sessionId: string,
    rawEvent: Record<string, unknown>,
  ): Promise<NormalizedRealtimeEvent | null> {
    // Validate protocol shape
    validateRawEvent(rawEvent);

    const type = String(rawEvent['type']);

    // Session lifecycle — informational only, emit session_ready
    if (type === OPENAI_EVENT_SESSION_CREATED || type === OPENAI_EVENT_SESSION_UPDATED) {
      return {
        type: 'session_ready',
        sessionId,
        payload: { sessionType: type },
      };
    }

    // Internal events (from WebSocket manager itself)
    if (type.startsWith('_internal.')) {
      return null;
    }

    // Error event from OpenAI
    if (type === OPENAI_EVENT_ERROR) {
      const error = rawEvent['error'] as Record<string, unknown> | undefined;
      const code = String(error?.['code'] ?? 'unknown');
      const message = String(error?.['message'] ?? 'Unknown OpenAI error');
      const eventId = error?.['event_id'] ? String(error['event_id']) : undefined;
      throw new OpenAiApiError(code, message, eventId);
    }

    // Audio delta
    if (type === OPENAI_EVENT_RESPONSE_AUDIO_DELTA) {
      const handler = this.getOrCreateResponseHandler(sessionId);
      const frame = handler.handleAudioDelta(sessionId, rawEvent);
      if (frame) {
        return { type: 'audio_frame', sessionId, payload: frame };
      }
      return null;
    }

    // Response done (usage)
    if (type === OPENAI_EVENT_RESPONSE_DONE) {
      const handler = this.getOrCreateResponseHandler(sessionId);
      const usage = handler.handleResponseDone(sessionId, rawEvent);
      if (usage) {
        return { type: 'usage', sessionId, payload: usage };
      }
      return null;
    }

    // Transcript events
    const transcriptEvent = this.transcriptHandler.handle(rawEvent);
    if (transcriptEvent) {
      return { type: 'transcript', sessionId, payload: transcriptEvent };
    }

    // Tool call events
    const toolHandler = this.toolHandlers.get(sessionId);
    if (toolHandler) {
      const toolEvent = toolHandler.handle(sessionId, rawEvent);
      if (toolEvent) {
        return { type: 'tool_call', sessionId, payload: toolEvent };
      }
    }

    // Interruption events
    const interruptionEvent = this.interruptionHandler.handle(rawEvent);
    if (interruptionEvent) {
      return { type: 'interruption', sessionId, payload: interruptionEvent };
    }

    // All other events (session updates, rate limits, etc.) are silently ignored
    return null;
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private getOrCreateResponseHandler(sessionId: string): OpenAiResponseHandler {
    let handler = this.responseHandlers.get(sessionId);
    if (!handler) {
      handler = this.responseHandlerFactory(sessionId);
      this.responseHandlers.set(sessionId, handler);
    }
    return handler;
  }
}

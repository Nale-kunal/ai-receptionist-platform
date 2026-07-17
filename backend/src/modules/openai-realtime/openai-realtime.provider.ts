/**
 * OpenAI Realtime Provider
 *
 * Implements IRealtimeAiProvider for OpenAI's Realtime API.
 *
 * Responsibilities:
 *   - Manage WebSocket lifecycle per session
 *   - Coordinate event normalization via the internal event router
 *   - Stream audio bidirectionally between telephony and OpenAI
 *   - Report metrics and audit events
 *   - Enforce circuit breaker, heartbeat, idle timeout, reconnect
 *
 * This class has ZERO knowledge of:
 *   - Business domain logic
 *   - Appointments, patients, clinics, conversations
 *   - Prompt composition
 *   - Conversation orchestration
 *
 * All provider-specific protocol types stay inside this module.
 */

import type { IRealtimeAiProvider } from '../realtime-ai-adapter/interfaces/realtime-ai.interfaces';
import type { RealtimeAudioFrame } from '../realtime-ai-adapter/types/realtime-ai.types';
import type { RealtimeProviderType } from '../realtime-ai-adapter/constants/realtime-ai.constants';
import { REALTIME_PROVIDER_OPENAI } from '../realtime-ai-adapter/constants/realtime-ai.constants';
import { RealtimeProviderUnavailableError } from '../realtime-ai-adapter/errors/realtime-ai.errors';

import { OpenAiRealtimeWebSocketManager, type WebSocketFactory } from './openai-realtime.websocket';
import { OpenAiRealtimeSessionManager } from './openai-realtime.session.manager';
import { OpenAiRealtimeAudioStream } from './openai-realtime.audio.stream';
import { OpenAiRealtimeEventRouter } from './openai-realtime.event.router';
import { OpenAiResponseHandler } from './openai-realtime.response.handler';
import { OpenAiRealtimeMetricsCollector } from './openai-realtime.metrics.collector';
import { OpenAiRealtimeAuditLogger } from './openai-realtime.audit.logger';
import { validateSessionConfig } from './openai-realtime.validators';
import {
  OpenAiConnectionFailedError,
  OpenAiSessionNotFoundError,
  OpenAiApiError,
} from './openai-realtime.errors';
import {
  OPENAI_CLIENT_EVENT_SESSION_UPDATE,
  OPENAI_CLIENT_EVENT_INPUT_AUDIO_BUFFER_APPEND,
  OPENAI_CLIENT_EVENT_CONVERSATION_ITEM_CREATE,
} from './openai-realtime.constants';
import type { OpenAiRealtimeProviderConfig } from './openai-realtime.config';
import { loadOpenAiRealtimeConfig } from './openai-realtime.config';

// ---------------------------------------------------------------------------
// Provider Implementation
// ---------------------------------------------------------------------------

export class OpenAiRealtimeProvider implements IRealtimeAiProvider {
  public readonly providerName: RealtimeProviderType = REALTIME_PROVIDER_OPENAI;

  private readonly wsManager: OpenAiRealtimeWebSocketManager;
  private readonly sessionManager: OpenAiRealtimeSessionManager;
  private readonly audioStream: OpenAiRealtimeAudioStream;
  private readonly eventRouter: OpenAiRealtimeEventRouter;
  private readonly metrics: OpenAiRealtimeMetricsCollector;
  private readonly audit: OpenAiRealtimeAuditLogger;
  private readonly config: OpenAiRealtimeProviderConfig;

  constructor(
    config?: Partial<OpenAiRealtimeProviderConfig>,
    wsFactory?: WebSocketFactory,
  ) {
    this.config = loadOpenAiRealtimeConfig(config);
    this.sessionManager = new OpenAiRealtimeSessionManager();
    this.wsManager = new OpenAiRealtimeWebSocketManager(this.config, wsFactory);
    this.audioStream = new OpenAiRealtimeAudioStream();
    this.metrics = new OpenAiRealtimeMetricsCollector();
    this.audit = new OpenAiRealtimeAuditLogger();

    // Event router needs access to response handler per session
    this.eventRouter = new OpenAiRealtimeEventRouter(
      (sessionId) => new OpenAiResponseHandler(this.sessionManager),
    );
  }

  // ---------------------------------------------------------------------------
  // IRealtimeAiProvider: Connection Lifecycle
  // ---------------------------------------------------------------------------

  public async connect(sessionId: string, apiKey: string): Promise<void> {
    if (!apiKey || apiKey.trim() === '') {
      throw new RealtimeProviderUnavailableError(
        this.providerName,
        'API key is required to connect to OpenAI Realtime.',
      );
    }

    try {
      const model = this.config.defaultModel;
      await this.wsManager.connect(sessionId, apiKey, model);
      await this.audit.logConnectionEstablished(sessionId, model);
    } catch (err) {
      this.metrics.recordConnectionFailure();
      if (err instanceof OpenAiConnectionFailedError) {
        throw new RealtimeProviderUnavailableError(this.providerName, err.message);
      }
      throw err;
    }
  }

  public async disconnect(sessionId: string): Promise<void> {
    try {
      await this.wsManager.disconnect(sessionId);
      this.audioStream.close(sessionId);
      this.eventRouter.unregisterSession(sessionId);

      const session = this.sessionManager.has(sessionId)
        ? this.sessionManager.get(sessionId)
        : null;

      const durationMs = session
        ? Date.now() - session.createdAt
        : 0;

      this.metrics.recordSessionEnd(sessionId, durationMs);
      this.sessionManager.remove(sessionId);

      await this.audit.logConnectionClosed(sessionId, 'graceful_disconnect');
    } catch {
      // Non-fatal: clean up what we can
      this.audioStream.close(sessionId);
      this.eventRouter.unregisterSession(sessionId);
      this.sessionManager.remove(sessionId);
    }
  }

  // ---------------------------------------------------------------------------
  // IRealtimeAiProvider: Session Configuration
  // ---------------------------------------------------------------------------

  public async createSession(
    sessionId: string,
    config: Record<string, unknown>,
  ): Promise<void> {
    const validated = validateSessionConfig(config);

    // Register in internal session manager
    this.sessionManager.create(sessionId, {
      model: validated.model as never ?? this.config.defaultModel,
      voice: validated.voice as never ?? this.config.defaultVoice,
      instructions: validated.instructions ?? '',
      tools: (validated.tools ?? []) as Array<Record<string, unknown>>,
      temperature: validated.temperature ?? this.config.temperature,
      maxResponseOutputTokens: this.config.maxResponseOutputTokens,
    });

    // Initialize audio stream
    this.audioStream.initSession(sessionId);

    // Register in event router
    this.eventRouter.registerSession(sessionId);

    // Start recording metrics
    this.metrics.recordSessionStart(sessionId);

    // Send session.update to OpenAI
    await this.wsManager.send(sessionId, {
      type: OPENAI_CLIENT_EVENT_SESSION_UPDATE,
      session: {
        model: validated.model ?? this.config.defaultModel,
        voice: validated.voice ?? this.config.defaultVoice,
        instructions: validated.instructions ?? '',
        input_audio_format: this.config.audioFormat,
        output_audio_format: this.config.audioFormat,
        tools: validated.tools ?? [],
        temperature: validated.temperature ?? this.config.temperature,
        max_response_output_tokens: this.config.maxResponseOutputTokens,
        ...(this.config.turnDetection.enabled
          ? {
              turn_detection: {
                type: this.config.turnDetection.type,
                threshold: this.config.turnDetection.threshold,
                prefix_padding_ms: this.config.turnDetection.prefixPaddingMs,
                silence_duration_ms: this.config.turnDetection.silenceDurationMs,
              },
            }
          : { turn_detection: null }),
      },
    });
  }

  public async closeSession(sessionId: string): Promise<void> {
    await this.disconnect(sessionId);
  }

  public async updateSession(
    sessionId: string,
    config: Record<string, unknown>,
  ): Promise<void> {
    const validated = validateSessionConfig(config);
    this.sessionManager.update(sessionId, {
      ...(validated.model ? { model: validated.model as never } : {}),
      ...(validated.voice ? { voice: validated.voice as never } : {}),
      ...(validated.instructions !== undefined ? { instructions: validated.instructions } : {}),
      ...(validated.temperature !== undefined ? { temperature: validated.temperature } : {}),
      ...(validated.tools ? { tools: validated.tools as Array<Record<string, unknown>> } : {}),
    });

    await this.wsManager.send(sessionId, {
      type: OPENAI_CLIENT_EVENT_SESSION_UPDATE,
      session: validated,
    });
  }

  // ---------------------------------------------------------------------------
  // IRealtimeAiProvider: Audio
  // ---------------------------------------------------------------------------

  public async sendAudio(sessionId: string, frame: RealtimeAudioFrame): Promise<void> {
    const base64Audio = OpenAiRealtimeAudioStream.encodeToBase64(frame.payload);

    this.audioStream.pushInboundFrame({
      sessionId,
      sequence: this.sessionManager.nextInboundSequence(sessionId),
      timestamp: frame.timestamp,
      base64Audio,
      codec: frame.codec,
      durationMs: frame.durationMs,
    });

    // Send audio chunk directly to OpenAI
    await this.wsManager.send(sessionId, {
      type: OPENAI_CLIENT_EVENT_INPUT_AUDIO_BUFFER_APPEND,
      audio: base64Audio,
    });

    this.metrics.recordAudioFrameSent(sessionId, frame.payload.byteLength);
  }

  public async *receiveAudio(sessionId: string): AsyncIterable<RealtimeAudioFrame> {
    yield* this.audioStream.outboundFrames(sessionId);
  }

  // ---------------------------------------------------------------------------
  // IRealtimeAiProvider: Text
  // ---------------------------------------------------------------------------

  public async sendText(sessionId: string, text: string): Promise<void> {
    await this.wsManager.send(sessionId, {
      type: OPENAI_CLIENT_EVENT_CONVERSATION_ITEM_CREATE,
      item: {
        type: 'message',
        role: 'user',
        content: [{ type: 'input_text', text }],
      },
    });
  }

  // ---------------------------------------------------------------------------
  // IRealtimeAiProvider: Receive Events (normalized)
  // ---------------------------------------------------------------------------

  public async *receiveEvents(
    sessionId: string,
  ): AsyncIterable<Record<string, unknown>> {
    for await (const rawEvent of this.wsManager.messages(sessionId)) {
      try {
        const normalized = await this.eventRouter.route(sessionId, rawEvent);
        if (normalized) {
          // Push outbound audio frames into the audio stream
          if (normalized.type === 'audio_frame') {
            this.audioStream.pushOutboundFrameForSession(
              sessionId,
              normalized.payload as RealtimeAudioFrame,
            );
            this.metrics.recordAudioFrameReceived(
              sessionId,
              (normalized.payload as RealtimeAudioFrame).payload.byteLength,
            );
          }

          // Track token usage
          if (normalized.type === 'usage') {
            const usage = normalized.payload as { inputTokens: number; outputTokens: number };
            await this.audit.logTokenUsage(sessionId, usage.inputTokens, usage.outputTokens);
            this.metrics.recordUsage({
              inputTokens: usage.inputTokens,
              outputTokens: usage.outputTokens,
              totalTokens: usage.inputTokens + usage.outputTokens,
              capturedAt: Date.now(),
            });
          }

          // Track tool calls for audit
          if (normalized.type === 'tool_call') {
            const toolEvent = normalized.payload as { toolCalls: Array<{ id: string; name: string }> };
            for (const call of toolEvent.toolCalls) {
              await this.audit.logToolCallReceived(sessionId, call.id, call.name);
            }
          }

          // Yield canonical event to the caller
          yield {
            type: normalized.type,
            sessionId,
            payload: normalized.payload,
          };
        }
      } catch (err) {
        if (err instanceof OpenAiApiError) {
          await this.audit.logApiError(sessionId, err.code, err.message);
        }
        // Re-yield as an error event — caller decides recovery strategy
        yield {
          type: 'error',
          sessionId,
          error: {
            code: err instanceof Error ? (err as { code?: string }).code ?? 'UNKNOWN' : 'UNKNOWN',
            message: err instanceof Error ? err.message : String(err),
          },
        };
      }
    }
  }

  // ---------------------------------------------------------------------------
  // IRealtimeAiProvider: Heartbeat & Status
  // ---------------------------------------------------------------------------

  public async heartbeat(sessionId: string): Promise<void> {
    await this.wsManager.ping(sessionId);
  }

  public connectionStatus(
    sessionId: string,
  ): 'connected' | 'connecting' | 'disconnected' {
    const status = this.wsManager.connectionStatus(sessionId);
    if (status === 'connected') return 'connected';
    if (status === 'connecting' || status === 'reconnecting') return 'connecting';
    return 'disconnected';
  }

  // ---------------------------------------------------------------------------
  // Provider-Specific Accessors (for testing and observability)
  // ---------------------------------------------------------------------------

  public getMetrics() {
    return this.metrics.toRealtimeMetrics();
  }

  public activeSessionCount(): number {
    return this.sessionManager.activeCount();
  }
}

/**
 * OpenAI Realtime Provider — Internal Interfaces
 *
 * These contracts define the seams between internal components.
 * Not exported from the module barrel.
 */

import type { RealtimeAudioFrame } from '../realtime-ai-adapter/types/realtime-ai.types';
import type {
  OpenAiWsConnectionStatus,
  OpenAiWsSession,
  OpenAiAudioChunk,
  OpenAiUsageSnapshot,
  CircuitBreakerStatus,
} from './openai-realtime.types';

// ---------------------------------------------------------------------------
// WebSocket Manager Interface
// ---------------------------------------------------------------------------

export interface IOpenAiWebSocketManager {
  /**
   * Establish a WebSocket connection to OpenAI Realtime API.
   * Authenticates using the provided API key.
   * Handles exponential backoff reconnect and heartbeat.
   */
  connect(sessionId: string, apiKey: string, model: string): Promise<void>;

  /**
   * Gracefully close the WebSocket connection.
   */
  disconnect(sessionId: string): Promise<void>;

  /**
   * Send a typed JSON message to OpenAI over the WebSocket.
   */
  send(sessionId: string, event: Record<string, unknown>): Promise<void>;

  /**
   * Yield all incoming raw WebSocket messages for a session.
   */
  messages(sessionId: string): AsyncIterable<Record<string, unknown>>;

  /**
   * Returns current connection status.
   */
  connectionStatus(sessionId: string): OpenAiWsConnectionStatus;

  /**
   * Returns the internal session record (for metrics/diagnostics).
   */
  getSession(sessionId: string): OpenAiWsSession | undefined;

  /**
   * Send a heartbeat ping to keep the connection alive.
   */
  ping(sessionId: string): Promise<void>;

  /**
   * Returns the circuit breaker status.
   */
  circuitBreakerStatus(sessionId: string): CircuitBreakerStatus;
}

// ---------------------------------------------------------------------------
// Audio Stream Interface
// ---------------------------------------------------------------------------

export interface IOpenAiAudioStream {
  /**
   * Push an inbound audio frame (from telephony) into the stream buffer.
   */
  pushInboundFrame(chunk: OpenAiAudioChunk): void;

  /**
   * Yield inbound audio frames as an async iterable.
   * Used by the provider to send audio to OpenAI.
   */
  inboundFrames(sessionId: string): AsyncIterable<OpenAiAudioChunk>;

  /**
   * Push an outbound audio frame (from OpenAI) into the stream buffer.
   */
  pushOutboundFrame(frame: RealtimeAudioFrame): void;

  /**
   * Yield outbound audio frames as an async iterable.
   * Used by the adapter to deliver OpenAI audio to the telephony layer.
   */
  outboundFrames(sessionId: string): AsyncIterable<RealtimeAudioFrame>;

  /**
   * Signal end of stream (call ended or interrupted).
   */
  close(sessionId: string): void;

  /**
   * Returns the current frame count in inbound buffer.
   */
  inboundBufferSize(sessionId: string): number;
}

// ---------------------------------------------------------------------------
// Event Router Interface
// ---------------------------------------------------------------------------

export interface IOpenAiEventRouter {
  /**
   * Route a raw OpenAI server event to the appropriate handler.
   * Returns a normalized canonical event or null if the event is
   * informational only (e.g., session.created confirmation).
   */
  route(
    sessionId: string,
    rawEvent: Record<string, unknown>,
  ): Promise<NormalizedRealtimeEvent | null>;
}

// ---------------------------------------------------------------------------
// Normalized Event (result of event routing)
// ---------------------------------------------------------------------------

export type NormalizedRealtimeEventType =
  | 'transcript'
  | 'tool_call'
  | 'interruption'
  | 'audio_frame'
  | 'usage'
  | 'error'
  | 'session_ready';

export interface NormalizedRealtimeEvent {
  type: NormalizedRealtimeEventType;
  sessionId: string;
  payload: unknown;
}

// ---------------------------------------------------------------------------
// Metrics Collector Interface
// ---------------------------------------------------------------------------

export interface IOpenAiMetricsCollector {
  recordSessionStart(sessionId: string): void;
  recordSessionEnd(sessionId: string, durationMs: number): void;
  recordUsage(snapshot: OpenAiUsageSnapshot): void;
  recordAudioFrameSent(sessionId: string, bytes: number): void;
  recordAudioFrameReceived(sessionId: string, bytes: number): void;
  recordReconnect(sessionId: string): void;
  recordConnectionFailure(): void;
  recordResponseLatency(sessionId: string, latencyMs: number): void;
  getActiveSessionCount(): number;
  getTotalTokensUsed(): number;
  getAverageResponseLatencyMs(): number;
}

// ---------------------------------------------------------------------------
// Audit Logger Interface
// ---------------------------------------------------------------------------

export interface IOpenAiAuditLogger {
  logConnectionEstablished(sessionId: string, model: string): Promise<void>;
  logConnectionClosed(sessionId: string, reason: string): Promise<void>;
  logReconnectAttempt(sessionId: string, attempt: number, maxAttempts: number): Promise<void>;
  logApiError(sessionId: string, code: string, message: string): Promise<void>;
  logToolCallReceived(sessionId: string, callId: string, name: string): Promise<void>;
  logTokenUsage(sessionId: string, inputTokens: number, outputTokens: number): Promise<void>;
  logCircuitBreakerOpened(sessionId: string): Promise<void>;
  logCircuitBreakerClosed(sessionId: string): Promise<void>;
}

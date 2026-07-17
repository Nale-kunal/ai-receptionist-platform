/**
 * OpenAI Realtime Provider — Internal Types
 *
 * These types model the OpenAI Realtime API WebSocket protocol.
 * They are INTERNAL to this module and MUST NOT be imported outside openai-realtime/.
 * All consumer-facing events use normalized types from realtime-ai-adapter.
 */

import type { OpenAiAudioFormat, OpenAiVoice, OpenAiRealtimeModel } from './openai-realtime.constants';

// ---------------------------------------------------------------------------
// WebSocket Connection State
// ---------------------------------------------------------------------------

export type OpenAiWsConnectionStatus =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'disconnected'
  | 'failed';

// ---------------------------------------------------------------------------
// Circuit Breaker State
// ---------------------------------------------------------------------------

export type CircuitBreakerState = 'closed' | 'open' | 'half-open';

export interface CircuitBreakerStatus {
  state: CircuitBreakerState;
  consecutiveFailures: number;
  consecutiveSuccesses: number;
  openedAt: number | null;
  nextAttemptAt: number | null;
}

// ---------------------------------------------------------------------------
// Internal Session Record (per WebSocket connection)
// ---------------------------------------------------------------------------

export interface OpenAiWsSession {
  sessionId: string;
  wsUrl: string;
  ws: unknown; // EventEmitter-based WebSocket; typed as unknown to avoid ws dep
  status: OpenAiWsConnectionStatus;
  connectedAt: number | null;
  lastPingAt: number | null;
  lastPongAt: number | null;
  reconnectAttempt: number;
  heartbeatTimer: ReturnType<typeof setInterval> | null;
  idleTimer: ReturnType<typeof setTimeout> | null;
  audioSequence: number;
  eventBuffer: Array<Record<string, unknown>>;
  circuitBreaker: CircuitBreakerStatus;
}

// ---------------------------------------------------------------------------
// OpenAI Server Event Envelope
// ---------------------------------------------------------------------------

export interface OpenAiBaseServerEvent {
  type: string;
  event_id?: string;
}

// ---------------------------------------------------------------------------
// Session Events
// ---------------------------------------------------------------------------

export interface OpenAiSessionObject {
  id: string;
  model: OpenAiRealtimeModel;
  modalities: string[];
  instructions?: string;
  voice: OpenAiVoice;
  input_audio_format: OpenAiAudioFormat;
  output_audio_format: OpenAiAudioFormat;
  turn_detection?: {
    type: 'server_vad' | 'none';
    threshold?: number;
    prefix_padding_ms?: number;
    silence_duration_ms?: number;
  } | null;
  tools?: OpenAiToolDefinition[];
  tool_choice?: 'auto' | 'none' | 'required' | { type: 'function'; name: string };
  temperature?: number;
  max_response_output_tokens?: number | 'inf';
}

export interface OpenAiSessionCreatedEvent extends OpenAiBaseServerEvent {
  type: 'session.created';
  session: OpenAiSessionObject;
}

export interface OpenAiSessionUpdatedEvent extends OpenAiBaseServerEvent {
  type: 'session.updated';
  session: OpenAiSessionObject;
}

// ---------------------------------------------------------------------------
// Error Event
// ---------------------------------------------------------------------------

export interface OpenAiErrorEvent extends OpenAiBaseServerEvent {
  type: 'error';
  error: {
    type: string;
    code?: string;
    message: string;
    param?: string;
    event_id?: string;
  };
}

// ---------------------------------------------------------------------------
// Audio Buffer Events
// ---------------------------------------------------------------------------

export interface OpenAiSpeechStartedEvent extends OpenAiBaseServerEvent {
  type: 'input_audio_buffer.speech_started';
  audio_start_ms: number;
  item_id: string;
}

export interface OpenAiSpeechStoppedEvent extends OpenAiBaseServerEvent {
  type: 'input_audio_buffer.speech_stopped';
  audio_end_ms: number;
  item_id: string;
}

// ---------------------------------------------------------------------------
// Transcript Events
// ---------------------------------------------------------------------------

export interface OpenAiTranscriptionCompletedEvent extends OpenAiBaseServerEvent {
  type: 'conversation.item.input_audio_transcription.completed';
  item_id: string;
  content_index: number;
  transcript: string;
}

export interface OpenAiResponseAudioTranscriptDeltaEvent extends OpenAiBaseServerEvent {
  type: 'response.audio_transcript.delta';
  response_id: string;
  item_id: string;
  output_index: number;
  content_index: number;
  delta: string;
}

export interface OpenAiResponseAudioTranscriptDoneEvent extends OpenAiBaseServerEvent {
  type: 'response.audio_transcript.done';
  response_id: string;
  item_id: string;
  output_index: number;
  content_index: number;
  transcript: string;
}

// ---------------------------------------------------------------------------
// Audio Delta Events
// ---------------------------------------------------------------------------

export interface OpenAiResponseAudioDeltaEvent extends OpenAiBaseServerEvent {
  type: 'response.audio.delta';
  response_id: string;
  item_id: string;
  output_index: number;
  content_index: number;
  delta: string; // base64-encoded PCM16 audio
}

export interface OpenAiResponseAudioDoneEvent extends OpenAiBaseServerEvent {
  type: 'response.audio.done';
  response_id: string;
  item_id: string;
  output_index: number;
  content_index: number;
}

// ---------------------------------------------------------------------------
// Function Call Events (Tool Calls)
// ---------------------------------------------------------------------------

export interface OpenAiFunctionCallArgumentsDeltaEvent extends OpenAiBaseServerEvent {
  type: 'response.function_call_arguments.delta';
  response_id: string;
  item_id: string;
  output_index: number;
  call_id: string;
  delta: string;
}

export interface OpenAiFunctionCallArgumentsDoneEvent extends OpenAiBaseServerEvent {
  type: 'response.function_call_arguments.done';
  response_id: string;
  item_id: string;
  output_index: number;
  call_id: string;
  name: string;
  arguments: string; // JSON string
}

// ---------------------------------------------------------------------------
// Response Lifecycle Events
// ---------------------------------------------------------------------------

export interface OpenAiResponseObject {
  id: string;
  status: 'in_progress' | 'completed' | 'cancelled' | 'incomplete' | 'failed';
  usage?: {
    total_tokens: number;
    input_tokens: number;
    output_tokens: number;
  };
}

export interface OpenAiResponseDoneEvent extends OpenAiBaseServerEvent {
  type: 'response.done';
  response: OpenAiResponseObject;
}

// ---------------------------------------------------------------------------
// Tool Definition (sent as part of session.update)
// ---------------------------------------------------------------------------

export interface OpenAiToolDefinition {
  type: 'function';
  name: string;
  description?: string;
  parameters?: Record<string, unknown>; // JSON Schema
}

// ---------------------------------------------------------------------------
// Client Events (outbound to OpenAI WebSocket)
// ---------------------------------------------------------------------------

export interface OpenAiSessionUpdateClientEvent {
  type: 'session.update';
  session: Partial<OpenAiSessionObject>;
}

export interface OpenAiInputAudioBufferAppendClientEvent {
  type: 'input_audio_buffer.append';
  audio: string; // base64-encoded audio
}

export interface OpenAiInputAudioBufferCommitClientEvent {
  type: 'input_audio_buffer.commit';
}

export interface OpenAiInputAudioBufferClearClientEvent {
  type: 'input_audio_buffer.clear';
}

export interface OpenAiConversationItemCreateClientEvent {
  type: 'conversation.item.create';
  item: {
    type: 'message';
    role: 'user' | 'assistant' | 'system';
    content: Array<{
      type: 'input_text' | 'text';
      text: string;
    }>;
  };
}

export interface OpenAiResponseCreateClientEvent {
  type: 'response.create';
  response?: {
    modalities?: string[];
    instructions?: string;
    voice?: OpenAiVoice;
    output_audio_format?: OpenAiAudioFormat;
    tools?: OpenAiToolDefinition[];
    tool_choice?: string;
    temperature?: number;
    max_output_tokens?: number | 'inf';
  };
}

export interface OpenAiResponseCancelClientEvent {
  type: 'response.cancel';
}

// ---------------------------------------------------------------------------
// Internal Audio Frame Buffer
// ---------------------------------------------------------------------------

export interface OpenAiAudioChunk {
  sessionId: string;
  sequence: number;
  timestamp: number;
  base64Audio: string;
  codec: string;
  durationMs: number;
}

// ---------------------------------------------------------------------------
// Usage Snapshot (for metrics)
// ---------------------------------------------------------------------------

export interface OpenAiUsageSnapshot {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  capturedAt: number;
}

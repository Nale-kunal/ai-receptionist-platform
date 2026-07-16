import type { RealtimeSessionState, RealtimeProviderType } from '../constants/realtime-ai.constants';

// ---------------------------------------------------------------------------
// Realtime Audio Frame
// ---------------------------------------------------------------------------

export interface RealtimeAudioFrame {
  sequence: number;
  timestamp: number;
  payload: Buffer;
  codec: string;
  durationMs: number;
}

// ---------------------------------------------------------------------------
// Session Metadata
// ---------------------------------------------------------------------------

export interface RealtimeSessionMetadata {
  direction?: 'inbound' | 'outbound' | 'bidirectional';
  model?: string;
  voice?: string;
  language?: string;
  reconnectCount?: number;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Safe Realtime Session DTO (hiding internal database keys)
// ---------------------------------------------------------------------------

export interface SafeRealtimeSession {
  sessionId: string;
  tenantId: string;
  clinicId: string | null;
  conversationId: string;
  provider: RealtimeProviderType;
  providerSessionId: string;
  connectionState: RealtimeSessionState;
  createdAt: Date;
  updatedAt: Date;
  endedAt: Date | null;
  metadata: RealtimeSessionMetadata;
}

// ---------------------------------------------------------------------------
// Realtime Events
// ---------------------------------------------------------------------------

export interface RealtimeTranscriptEvent {
  text: string;
  isFinal: boolean;
  speaker: 'user' | 'assistant';
}

export interface RealtimeToolCall {
  id: string;
  name: string;
  arguments: string; // JSON string
}

export interface RealtimeToolCallEvent {
  toolCalls: RealtimeToolCall[];
}

export interface RealtimeInterruptionEvent {
  interruptedAtMs: number;
  audioOffsetMs: number;
}

// ---------------------------------------------------------------------------
// Realtime Metrics format
// ---------------------------------------------------------------------------

export interface RealtimeMetrics {
  concurrentSessions: number;
  totalTokensUsed: number;
  inputTokensCount: number;
  outputTokensCount: number;
  averageResponseTimeMs: number;
  totalCostEstimateUSD: number;
  reconnectAttemptsCount: number;
  failedConnectionsCount: number;
}

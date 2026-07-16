/**
 * Voice Server Infrastructure Types
 */

// ---------------------------------------------------------------------------
// Session States
// ---------------------------------------------------------------------------

export const VOICE_SESSION_STATE_CREATED       = 'CREATED'       as const;
export const VOICE_SESSION_STATE_CONNECTING    = 'CONNECTING'    as const;
export const VOICE_SESSION_STATE_CONNECTED     = 'CONNECTED'     as const;
export const VOICE_SESSION_STATE_STREAMING     = 'STREAMING'     as const;
export const VOICE_SESSION_STATE_PAUSED        = 'PAUSED'        as const;
export const VOICE_SESSION_STATE_RESUMED       = 'RESUMED'       as const;
export const VOICE_SESSION_STATE_DISCONNECTING = 'DISCONNECTING' as const;
export const VOICE_SESSION_STATE_ENDED         = 'ENDED'         as const;
export const VOICE_SESSION_STATE_FAILED        = 'FAILED'        as const;

export const SUPPORTED_VOICE_SESSION_STATES = [
  VOICE_SESSION_STATE_CREATED,
  VOICE_SESSION_STATE_CONNECTING,
  VOICE_SESSION_STATE_CONNECTED,
  VOICE_SESSION_STATE_STREAMING,
  VOICE_SESSION_STATE_PAUSED,
  VOICE_SESSION_STATE_RESUMED,
  VOICE_SESSION_STATE_DISCONNECTING,
  VOICE_SESSION_STATE_ENDED,
  VOICE_SESSION_STATE_FAILED,
] as const;

export type VoiceSessionState = (typeof SUPPORTED_VOICE_SESSION_STATES)[number];

// ---------------------------------------------------------------------------
// Stream State
// ---------------------------------------------------------------------------
export type VoiceSessionStreamState = 'idle' | 'inbound' | 'outbound' | 'bidirectional' | 'paused';

// ---------------------------------------------------------------------------
// Audio Frame Structure
// ---------------------------------------------------------------------------
export interface AudioFrame {
  /** Sequential identifier of the frame in the stream */
  sequence: number;
  /** Relational timestamp (ms) since session start */
  timestamp: number;
  /** Audio binary content */
  payload: Buffer;
  /** Media MIME codec type (e.g. 'audio/PCMU') */
  codec: string;
  /** Approximate length in milliseconds represented by payload */
  durationMs: number;
}

// ---------------------------------------------------------------------------
// Session Metadata
// ---------------------------------------------------------------------------
export interface VoiceSessionMetadata {
  direction?: 'inbound' | 'outbound';
  callerId?: string;
  calledId?: string;
  reconnectCount?: number;
  codec?: string;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Session safe DTO exposed to public boundaries (stripping internal IDs)
// ---------------------------------------------------------------------------
export interface SafeVoiceSession {
  sessionId: string;
  tenantId: string;
  clinicId: string | null;
  provider: string;
  providerCallId: string;
  connectionState: VoiceSessionState;
  streamState: VoiceSessionStreamState;
  createdAt: Date;
  updatedAt: Date;
  endedAt: Date | null;
  metadata: VoiceSessionMetadata;
}

// ---------------------------------------------------------------------------
// Observability metrics format
// ---------------------------------------------------------------------------
export interface VoiceMetrics {
  concurrentSessions: number;
  averageLatencyMs: number;
  totalReconnectCount: number;
  totalDroppedFrames: number;
  estimatedPacketLossRate: number;
  audioBufferUsageRatio: number;
  averageSessionDurationMs: number;
  connectionFailuresCount: number;
  providerFailuresCount: number;
  totalStreamingDurationMs: number;
}

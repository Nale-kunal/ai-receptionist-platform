/**
 * Realtime AI Adapter Module Constants
 */

// ---------------------------------------------------------------------------
// Session States
// ---------------------------------------------------------------------------

export const REALTIME_SESSION_STATE_CREATED    = 'CREATED'    as const;
export const REALTIME_SESSION_STATE_CONNECTING = 'CONNECTING' as const;
export const REALTIME_SESSION_STATE_CONNECTED  = 'CONNECTED'  as const;
export const REALTIME_SESSION_STATE_STREAMING  = 'STREAMING'  as const;
export const REALTIME_SESSION_STATE_PAUSED     = 'PAUSED'     as const;
export const REALTIME_SESSION_STATE_ENDED      = 'ENDED'      as const;
export const REALTIME_SESSION_STATE_FAILED     = 'FAILED'     as const;

export const SUPPORTED_REALTIME_SESSION_STATES = [
  REALTIME_SESSION_STATE_CREATED,
  REALTIME_SESSION_STATE_CONNECTING,
  REALTIME_SESSION_STATE_CONNECTED,
  REALTIME_SESSION_STATE_STREAMING,
  REALTIME_SESSION_STATE_PAUSED,
  REALTIME_SESSION_STATE_ENDED,
  REALTIME_SESSION_STATE_FAILED,
] as const;

export type RealtimeSessionState = (typeof SUPPORTED_REALTIME_SESSION_STATES)[number];

// ---------------------------------------------------------------------------
// Realtime Providers
// ---------------------------------------------------------------------------

export const REALTIME_PROVIDER_OPENAI = 'openai' as const;
export const REALTIME_PROVIDER_GEMINI = 'gemini' as const;
export const REALTIME_PROVIDER_MOCK   = 'mock'   as const;

export const SUPPORTED_REALTIME_PROVIDERS = [
  REALTIME_PROVIDER_OPENAI,
  REALTIME_PROVIDER_GEMINI,
  REALTIME_PROVIDER_MOCK,
] as const;

export type RealtimeProviderType = (typeof SUPPORTED_REALTIME_PROVIDERS)[number];

// ---------------------------------------------------------------------------
// Rate Limiting and Payload Constraints
// ---------------------------------------------------------------------------

export const MAX_REALTIME_PAYLOAD_SIZE_BYTES = 131072; // 128 KB
export const DEFAULT_RATE_LIMIT_SESSIONS_PER_MIN = 30;
export const DEFAULT_HEARTBEAT_INTERVAL_MS = 10000;    // 10 seconds
export const DEFAULT_RECONNECT_ATTEMPTS = 5;
export const DEFAULT_IDLE_TIMEOUT_MS = 60000;          // 60 seconds

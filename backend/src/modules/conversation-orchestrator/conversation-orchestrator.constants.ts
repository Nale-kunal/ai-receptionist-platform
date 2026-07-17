/**
 * Conversation Orchestrator Module Constants
 */

export const ORCHESTRATION_STATE_CREATED      = 'CREATED'      as const;
export const ORCHESTRATION_STATE_INITIALIZING = 'INITIALIZING' as const;
export const ORCHESTRATION_STATE_GREETING     = 'GREETING'     as const;
export const ORCHESTRATION_STATE_LISTENING    = 'LISTENING'    as const;
export const ORCHESTRATION_STATE_PROCESSING   = 'PROCESSING'   as const;
export const ORCHESTRATION_STATE_RESPONDING   = 'RESPONDING'   as const;
export const ORCHESTRATION_STATE_WAITING      = 'WAITING'      as const;
export const ORCHESTRATION_STATE_INTERRUPTED  = 'INTERRUPTED'  as const;
export const ORCHESTRATION_STATE_RESUMED      = 'RESUMED'      as const;
export const ORCHESTRATION_STATE_ENDING       = 'ENDING'       as const;
export const ORCHESTRATION_STATE_COMPLETED    = 'COMPLETED'    as const;
export const ORCHESTRATION_STATE_FAILED       = 'FAILED'       as const;

export const SUPPORTED_ORCHESTRATION_STATES = [
  ORCHESTRATION_STATE_CREATED,
  ORCHESTRATION_STATE_INITIALIZING,
  ORCHESTRATION_STATE_GREETING,
  ORCHESTRATION_STATE_LISTENING,
  ORCHESTRATION_STATE_PROCESSING,
  ORCHESTRATION_STATE_RESPONDING,
  ORCHESTRATION_STATE_WAITING,
  ORCHESTRATION_STATE_INTERRUPTED,
  ORCHESTRATION_STATE_RESUMED,
  ORCHESTRATION_STATE_ENDING,
  ORCHESTRATION_STATE_COMPLETED,
  ORCHESTRATION_STATE_FAILED,
] as const;

export type OrchestrationState = (typeof SUPPORTED_ORCHESTRATION_STATES)[number];

// ---------------------------------------------------------------------------
// Timeout Constants (in milliseconds)
// ---------------------------------------------------------------------------

export const DEFAULT_AI_TIMEOUT_MS = 10000;
export const DEFAULT_PROVIDER_TIMEOUT_MS = 8000;
export const DEFAULT_INACTIVITY_TIMEOUT_MS = 30000;
export const DEFAULT_SESSION_TIMEOUT_MS = 1800000;
export const DEFAULT_SHUTDOWN_TIMEOUT_MS = 5000;

// ---------------------------------------------------------------------------
// Rate Limiting Defaults
// ---------------------------------------------------------------------------

export const DEFAULT_RATE_LIMIT_CONVERSATIONS = 100;
export const MAX_TRANSCRIPT_BUFFER_SIZE_CHARS = 100000;
export const MAX_ACTIVE_TIMERS_PER_SESSION = 50;

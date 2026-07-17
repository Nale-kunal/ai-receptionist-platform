/**
 * End-to-End Call Flow — Constants
 */

export const E2E_MODULE_NAME = 'end-to-end' as const;

// Call Lifecycle States
export const E2E_STATE_INCOMING_CALL           = 'INCOMING_CALL'           as const;
export const E2E_STATE_WEBHOOK_VALIDATED       = 'WEBHOOK_VALIDATED'       as const;
export const E2E_STATE_VOICE_SESSION_CREATED   = 'VOICE_SESSION_CREATED'   as const;
export const E2E_STATE_REALTIME_SESSION_CREATED = 'REALTIME_SESSION_CREATED' as const;
export const E2E_STATE_CONVERSATION_CREATED    = 'CONVERSATION_CREATED'    as const;
export const E2E_STATE_PROMPT_RESOLVED         = 'PROMPT_RESOLVED'         as const;
export const E2E_STATE_AI_READY                = 'AI_READY'                as const;
export const E2E_STATE_GREETING                = 'GREETING'                as const;
export const E2E_STATE_LISTENING               = 'LISTENING'               as const;
export const E2E_STATE_PROCESSING              = 'PROCESSING'              as const;
export const E2E_STATE_TOOL_EXECUTION           = 'TOOL_EXECUTION'           as const;
export const E2E_STATE_RESPONDING              = 'RESPONDING'              as const;
export const E2E_STATE_WAITING                 = 'WAITING'                 as const;
export const E2E_STATE_INTERRUPTED             = 'INTERRUPTED'             as const;
export const E2E_STATE_RESUMED                 = 'RESUMED'                 as const;
export const E2E_STATE_ENDING                  = 'ENDING'                  as const;
export const E2E_STATE_CALL_COMPLETED          = 'CALL_COMPLETED'          as const;
export const E2E_STATE_RESOURCE_CLEANUP        = 'RESOURCE_CLEANUP'        as const;
export const E2E_STATE_TERMINATED              = 'TERMINATED'              as const;

export const E2E_SUPPORTED_STATES = [
  E2E_STATE_INCOMING_CALL,
  E2E_STATE_WEBHOOK_VALIDATED,
  E2E_STATE_VOICE_SESSION_CREATED,
  E2E_STATE_REALTIME_SESSION_CREATED,
  E2E_STATE_CONVERSATION_CREATED,
  E2E_STATE_PROMPT_RESOLVED,
  E2E_STATE_AI_READY,
  E2E_STATE_GREETING,
  E2E_STATE_LISTENING,
  E2E_STATE_PROCESSING,
  E2E_STATE_TOOL_EXECUTION,
  E2E_STATE_RESPONDING,
  E2E_STATE_WAITING,
  E2E_STATE_INTERRUPTED,
  E2E_STATE_RESUMED,
  E2E_STATE_ENDING,
  E2E_STATE_CALL_COMPLETED,
  E2E_STATE_RESOURCE_CLEANUP,
  E2E_STATE_TERMINATED,
] as const;

export type E2eCallState = (typeof E2E_SUPPORTED_STATES)[number];

// Timing defaults
export const E2E_AI_RESPONSE_TIMEOUT_MS = 15000;
export const E2E_TOOL_EXECUTION_TIMEOUT_MS = 10000;
export const E2E_INACTIVITY_TIMEOUT_MS = 30000;
export const E2E_MAX_CALL_DURATION_MS = 1800000; // 30 minutes
export const E2E_RECONNECT_RETRY_ATTEMPTS = 3;
export const E2E_RECONNECT_BACKOFF_BASE_MS = 1000;

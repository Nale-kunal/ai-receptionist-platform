/**
 * Conversation Module Constants
 */

export const CONVERSATION_ROUTE_PREFIX = '/api/v1/conversations' as const;

// ---------------------------------------------------------------------------
// Conversation Statuses
// ---------------------------------------------------------------------------

export const CONVERSATION_STATUS_INITIATED = 'initiated' as const;
export const CONVERSATION_STATUS_ACTIVE    = 'active'    as const;
export const CONVERSATION_STATUS_COMPLETED = 'completed' as const;
export const CONVERSATION_STATUS_ABANDONED = 'abandoned' as const;
export const CONVERSATION_STATUS_FAILED    = 'failed'    as const;
export const CONVERSATION_STATUS_ARCHIVED  = 'archived'  as const;

export const CONVERSATION_STATUSES = [
  CONVERSATION_STATUS_INITIATED,
  CONVERSATION_STATUS_ACTIVE,
  CONVERSATION_STATUS_COMPLETED,
  CONVERSATION_STATUS_ABANDONED,
  CONVERSATION_STATUS_FAILED,
  CONVERSATION_STATUS_ARCHIVED,
] as const;

export type ConversationStatus = (typeof CONVERSATION_STATUSES)[number];

/** Terminal statuses — no further lifecycle transitions allowed */
export const TERMINAL_CONVERSATION_STATUSES: readonly ConversationStatus[] = [
  CONVERSATION_STATUS_ABANDONED,
  CONVERSATION_STATUS_FAILED,
  CONVERSATION_STATUS_ARCHIVED,
];

// ---------------------------------------------------------------------------
// Transcript Speaker Types
// ---------------------------------------------------------------------------

export const SPEAKER_AI      = 'ai'      as const;
export const SPEAKER_PATIENT = 'patient' as const;
export const SPEAKER_SYSTEM  = 'system'  as const;

export const SPEAKERS = [SPEAKER_AI, SPEAKER_PATIENT, SPEAKER_SYSTEM] as const;
export type TranscriptSpeaker = (typeof SPEAKERS)[number];

// ---------------------------------------------------------------------------
// Recording Statuses
// ---------------------------------------------------------------------------

export const RECORDING_STATUS_PENDING    = 'pending'    as const;
export const RECORDING_STATUS_AVAILABLE  = 'available'  as const;
export const RECORDING_STATUS_PROCESSING = 'processing' as const;
export const RECORDING_STATUS_FAILED     = 'failed'     as const;
export const RECORDING_STATUS_DELETED    = 'deleted'    as const;

export const RECORDING_STATUSES = [
  RECORDING_STATUS_PENDING,
  RECORDING_STATUS_AVAILABLE,
  RECORDING_STATUS_PROCESSING,
  RECORDING_STATUS_FAILED,
  RECORDING_STATUS_DELETED,
] as const;

export type RecordingStatus = (typeof RECORDING_STATUSES)[number];

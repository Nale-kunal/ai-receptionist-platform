/**
 * Conversation Module Domain Events
 */

// ---------------------------------------------------------------------------
// Event Type Constants
// ---------------------------------------------------------------------------

export const EVENT_CONVERSATION_STARTED    = 'conversation.started'     as const;
export const EVENT_CONVERSATION_UPDATED    = 'conversation.updated'     as const;
export const EVENT_CONVERSATION_COMPLETED  = 'conversation.completed'   as const;
export const EVENT_CONVERSATION_FAILED     = 'conversation.failed'      as const;
export const EVENT_CONVERSATION_ARCHIVED   = 'conversation.archived'    as const;
export const EVENT_TRANSCRIPT_UPDATED      = 'conversation.transcript_updated' as const;
export const EVENT_SUMMARY_GENERATED       = 'conversation.summary_generated'  as const;
export const EVENT_RECORDING_LINKED        = 'conversation.recording_linked'   as const;
export const EVENT_CONVERSATION_DELETED    = 'conversation.deleted'     as const;

// ---------------------------------------------------------------------------
// Base Payload
// ---------------------------------------------------------------------------

export interface BaseConversationEventPayload {
  tenantId: string;
  clinicId: string;
  conversationId: string;
  actorId: string;
  requestId: string;
  occurredAt: Date;
}

// ---------------------------------------------------------------------------
// Typed Event Interfaces
// ---------------------------------------------------------------------------

export interface ConversationStartedEvent {
  type: typeof EVENT_CONVERSATION_STARTED;
  payload: BaseConversationEventPayload & {
    callSessionId: string;
    patientId: string | null;
    language: string;
  };
}

export interface ConversationUpdatedEvent {
  type: typeof EVENT_CONVERSATION_UPDATED;
  payload: BaseConversationEventPayload & {
    changedFields: string[];
  };
}

export interface ConversationCompletedEvent {
  type: typeof EVENT_CONVERSATION_COMPLETED;
  payload: BaseConversationEventPayload & {
    durationSeconds: number | null;
  };
}

export interface ConversationFailedEvent {
  type: typeof EVENT_CONVERSATION_FAILED;
  payload: BaseConversationEventPayload;
}

export interface ConversationArchivedEvent {
  type: typeof EVENT_CONVERSATION_ARCHIVED;
  payload: BaseConversationEventPayload;
}

export interface TranscriptUpdatedEvent {
  type: typeof EVENT_TRANSCRIPT_UPDATED;
  payload: BaseConversationEventPayload & {
    transcriptVersion: number;
    turnCount: number;
  };
}

export interface SummaryGeneratedEvent {
  type: typeof EVENT_SUMMARY_GENERATED;
  payload: BaseConversationEventPayload & {
    intent: string | null;
  };
}

export interface RecordingLinkedEvent {
  type: typeof EVENT_RECORDING_LINKED;
  payload: BaseConversationEventPayload & {
    recordingProvider: string;
    recordingStatus: string;
  };
}

export interface ConversationDeletedEvent {
  type: typeof EVENT_CONVERSATION_DELETED;
  payload: BaseConversationEventPayload;
}

// ---------------------------------------------------------------------------
// Union Type
// ---------------------------------------------------------------------------

export type ConversationDomainEvent =
  | ConversationStartedEvent
  | ConversationUpdatedEvent
  | ConversationCompletedEvent
  | ConversationFailedEvent
  | ConversationArchivedEvent
  | TranscriptUpdatedEvent
  | SummaryGeneratedEvent
  | RecordingLinkedEvent
  | ConversationDeletedEvent;

/**
 * Calendar Module Domain Events
 */

// ---------------------------------------------------------------------------
// Event Type Constants
// ---------------------------------------------------------------------------

export const EVENT_CALENDAR_CONNECTED    = 'calendar.connected'    as const;
export const EVENT_CALENDAR_DISCONNECTED = 'calendar.disconnected' as const;
export const EVENT_CALENDAR_SYNC_STARTED  = 'calendar.sync.started'  as const;
export const EVENT_CALENDAR_SYNC_COMPLETED = 'calendar.sync.completed' as const;
export const EVENT_CALENDAR_SYNC_FAILED    = 'calendar.sync.failed'    as const;
export const EVENT_CALENDAR_WEBHOOK_PROCESSED = 'calendar.webhook.processed' as const;
export const EVENT_CALENDAR_CREDENTIAL_UPDATED = 'calendar.credential.updated' as const;

// ---------------------------------------------------------------------------
// Base Payload
// ---------------------------------------------------------------------------

export interface BaseCalendarEventPayload {
  tenantId: string;
  clinicId: string;
  calendarConnectionId: string;
  actorId: string;
  requestId: string;
  occurredAt: Date;
}

// ---------------------------------------------------------------------------
// Typed Event Interfaces
// ---------------------------------------------------------------------------

export interface CalendarConnectedEvent {
  type: typeof EVENT_CALENDAR_CONNECTED;
  payload: BaseCalendarEventPayload & {
    provider: string;
    calendarId: string;
  };
}

export interface CalendarDisconnectedEvent {
  type: typeof EVENT_CALENDAR_DISCONNECTED;
  payload: BaseCalendarEventPayload;
}

export interface CalendarSyncStartedEvent {
  type: typeof EVENT_CALENDAR_SYNC_STARTED;
  payload: BaseCalendarEventPayload & {
    appointmentId?: string | null;
    direction: 'push' | 'pull';
  };
}

export interface CalendarSyncCompletedEvent {
  type: typeof EVENT_CALENDAR_SYNC_COMPLETED;
  payload: BaseCalendarEventPayload & {
    appointmentId?: string | null;
    direction: 'push' | 'pull';
  };
}

export interface CalendarSyncFailedEvent {
  type: typeof EVENT_CALENDAR_SYNC_FAILED;
  payload: BaseCalendarEventPayload & {
    appointmentId?: string | null;
    direction: 'push' | 'pull';
    error: string;
  };
}

export interface CalendarWebhookProcessedEvent {
  type: typeof EVENT_CALENDAR_WEBHOOK_PROCESSED;
  payload: {
    tenantId: string;
    provider: string;
    occurredAt: Date;
    details: string;
  };
}

export interface CalendarCredentialUpdatedEvent {
  type: typeof EVENT_CALENDAR_CREDENTIAL_UPDATED;
  payload: BaseCalendarEventPayload;
}

// ---------------------------------------------------------------------------
// Union Type
// ---------------------------------------------------------------------------

export type CalendarDomainEvent =
  | CalendarConnectedEvent
  | CalendarDisconnectedEvent
  | CalendarSyncStartedEvent
  | CalendarSyncCompletedEvent
  | CalendarSyncFailedEvent
  | CalendarWebhookProcessedEvent
  | CalendarCredentialUpdatedEvent;

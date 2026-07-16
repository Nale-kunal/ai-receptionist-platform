/**
 * Notification Module Domain Events
 */

// ---------------------------------------------------------------------------
// Event Type Constants
// ---------------------------------------------------------------------------

export const EVENT_NOTIFICATION_CREATED   = 'notification.created'   as const;
export const EVENT_NOTIFICATION_QUEUED    = 'notification.queued'    as const;
export const EVENT_NOTIFICATION_SENT      = 'notification.sent'      as const;
export const EVENT_NOTIFICATION_DELIVERED = 'notification.delivered' as const;
export const EVENT_NOTIFICATION_FAILED    = 'notification.failed'    as const;
export const EVENT_NOTIFICATION_RETRIED   = 'notification.retried'   as const;
export const EVENT_NOTIFICATION_CANCELLED = 'notification.cancelled' as const;
export const EVENT_TEMPLATE_RENDERED      = 'notification.template_rendered' as const;

// ---------------------------------------------------------------------------
// Base Payload
// ---------------------------------------------------------------------------

export interface BaseNotificationEventPayload {
  tenantId: string;
  clinicId: string;
  notificationId: string;
  actorId: string;
  requestId: string;
  occurredAt: Date;
}

// ---------------------------------------------------------------------------
// Typed Event Interfaces
// ---------------------------------------------------------------------------

export interface NotificationCreatedEvent {
  type: typeof EVENT_NOTIFICATION_CREATED;
  payload: BaseNotificationEventPayload & {
    recipient: string;
    channel: string;
    type: string;
  };
}

export interface NotificationQueuedEvent {
  type: typeof EVENT_NOTIFICATION_QUEUED;
  payload: BaseNotificationEventPayload & {
    scheduledAt: Date | null;
  };
}

export interface NotificationSentEvent {
  type: typeof EVENT_NOTIFICATION_SENT;
  payload: BaseNotificationEventPayload & {
    provider: string;
  };
}

export interface NotificationDeliveredEvent {
  type: typeof EVENT_NOTIFICATION_DELIVERED;
  payload: BaseNotificationEventPayload & {
    deliveredAt: Date;
  };
}

export interface NotificationFailedEvent {
  type: typeof EVENT_NOTIFICATION_FAILED;
  payload: BaseNotificationEventPayload & {
    reason: string;
    willRetry: boolean;
  };
}

export interface NotificationRetriedEvent {
  type: typeof EVENT_NOTIFICATION_RETRIED;
  payload: BaseNotificationEventPayload & {
    retryCount: number;
  };
}

export interface NotificationCancelledEvent {
  type: typeof EVENT_NOTIFICATION_CANCELLED;
  payload: BaseNotificationEventPayload;
}

export interface TemplateRenderedEvent {
  type: typeof EVENT_TEMPLATE_RENDERED;
  payload: BaseNotificationEventPayload & {
    templateName: string;
    variables: string[];
  };
}

// ---------------------------------------------------------------------------
// Union Type
// ---------------------------------------------------------------------------

export type NotificationDomainEvent =
  | NotificationCreatedEvent
  | NotificationQueuedEvent
  | NotificationSentEvent
  | NotificationDeliveredEvent
  | NotificationFailedEvent
  | NotificationRetriedEvent
  | NotificationCancelledEvent
  | TemplateRenderedEvent;

/**
 * Notification Module Constants
 */

export const NOTIFICATION_ROUTE_PREFIX = '/api/v1/notifications' as const;

// ---------------------------------------------------------------------------
// Notification Channels
// ---------------------------------------------------------------------------

export const NOTIFICATION_CHANNEL_SMS   = 'sms'   as const;
export const NOTIFICATION_CHANNEL_EMAIL = 'email' as const;

export const NOTIFICATION_CHANNELS = [
  NOTIFICATION_CHANNEL_SMS,
  NOTIFICATION_CHANNEL_EMAIL,
] as const;

export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

// ---------------------------------------------------------------------------
// Notification Statuses
// ---------------------------------------------------------------------------

export const NOTIFICATION_STATUS_PENDING   = 'pending'   as const;
export const NOTIFICATION_STATUS_QUEUED    = 'queued'    as const;
export const NOTIFICATION_STATUS_SENDING   = 'sending'   as const;
export const NOTIFICATION_STATUS_SENT      = 'sent'      as const;
export const NOTIFICATION_STATUS_DELIVERED = 'delivered' as const;
export const NOTIFICATION_STATUS_FAILED    = 'failed'    as const;
export const NOTIFICATION_STATUS_CANCELLED = 'cancelled' as const;
export const NOTIFICATION_STATUS_EXPIRED   = 'expired'   as const;

export const NOTIFICATION_STATUSES = [
  NOTIFICATION_STATUS_PENDING,
  NOTIFICATION_STATUS_QUEUED,
  NOTIFICATION_STATUS_SENDING,
  NOTIFICATION_STATUS_SENT,
  NOTIFICATION_STATUS_DELIVERED,
  NOTIFICATION_STATUS_FAILED,
  NOTIFICATION_STATUS_CANCELLED,
  NOTIFICATION_STATUS_EXPIRED,
] as const;

export type NotificationStatus = (typeof NOTIFICATION_STATUSES)[number];

/** Terminal statuses — no further transitions allowed */
export const TERMINAL_NOTIFICATION_STATUSES: readonly NotificationStatus[] = [
  NOTIFICATION_STATUS_DELIVERED,
  NOTIFICATION_STATUS_CANCELLED,
  NOTIFICATION_STATUS_EXPIRED,
];

// ---------------------------------------------------------------------------
// Notification Types
// ---------------------------------------------------------------------------

export const NOTIFICATION_TYPE_APPOINTMENT_CONFIRMATION = 'appointment_confirmation' as const;
export const NOTIFICATION_TYPE_APPOINTMENT_REMINDER     = 'appointment_reminder'     as const;
export const NOTIFICATION_TYPE_APPOINTMENT_RESCHEDULED  = 'appointment_rescheduled'  as const;
export const NOTIFICATION_TYPE_APPOINTMENT_CANCELLED    = 'appointment_cancelled'    as const;
export const NOTIFICATION_TYPE_MISSED_APPOINTMENT       = 'missed_appointment'       as const;
export const NOTIFICATION_TYPE_PASSWORD_RESET           = 'password_reset'           as const;
export const NOTIFICATION_TYPE_EMAIL_VERIFICATION       = 'email_verification'       as const;
export const NOTIFICATION_TYPE_WELCOME_MESSAGE          = 'welcome_message'          as const;
export const NOTIFICATION_TYPE_SYSTEM_NOTIFICATION      = 'system_notification'      as const;

export const NOTIFICATION_TYPES = [
  NOTIFICATION_TYPE_APPOINTMENT_CONFIRMATION,
  NOTIFICATION_TYPE_APPOINTMENT_REMINDER,
  NOTIFICATION_TYPE_APPOINTMENT_RESCHEDULED,
  NOTIFICATION_TYPE_APPOINTMENT_CANCELLED,
  NOTIFICATION_TYPE_MISSED_APPOINTMENT,
  NOTIFICATION_TYPE_PASSWORD_RESET,
  NOTIFICATION_TYPE_EMAIL_VERIFICATION,
  NOTIFICATION_TYPE_WELCOME_MESSAGE,
  NOTIFICATION_TYPE_SYSTEM_NOTIFICATION,
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

// ---------------------------------------------------------------------------
// Notification Providers
// ---------------------------------------------------------------------------

export const NOTIFICATION_PROVIDER_SMTP   = 'smtp'   as const;
export const NOTIFICATION_PROVIDER_TWILIO = 'twilio_sms' as const;
export const NOTIFICATION_PROVIDER_MOCK   = 'mock'   as const;

export const NOTIFICATION_PROVIDERS = [
  NOTIFICATION_PROVIDER_SMTP,
  NOTIFICATION_PROVIDER_TWILIO,
  NOTIFICATION_PROVIDER_MOCK,
] as const;

export type NotificationProvider = (typeof NOTIFICATION_PROVIDERS)[number];

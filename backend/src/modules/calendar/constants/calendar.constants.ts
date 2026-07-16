/**
 * Calendar Module Constants
 */

export const CALENDAR_ROUTE_PREFIX = '/api/v1/calendations' as const; // Wait, let's look at the contract if there is a prefix specified. There isn't, so "/api/v1/calendars" or "/api/v1/calendar-connections" is perfect. Let's use "/api/v1/calendars".

export const CALENDAR_PROVIDER_GOOGLE = 'google' as const;
export const CALENDAR_PROVIDER_OUTLOOK = 'outlook' as const;

export const CALENDAR_PROVIDERS = [
  CALENDAR_PROVIDER_GOOGLE,
  CALENDAR_PROVIDER_OUTLOOK,
] as const;

export type CalendarProvider = (typeof CALENDAR_PROVIDERS)[number];

// ---------------------------------------------------------------------------
// Connection Statuses
// ---------------------------------------------------------------------------

export const CALENDAR_STATUS_PENDING      = 'pending'      as const;
export const CALENDAR_STATUS_CONNECTED    = 'connected'    as const;
export const CALENDAR_STATUS_DISCONNECTED = 'disconnected' as const;
export const CALENDAR_STATUS_EXPIRED      = 'expired'      as const;
export const CALENDAR_STATUS_ERROR        = 'error'        as const;
export const CALENDAR_STATUS_DISABLED     = 'disabled'     as const;

export const CALENDAR_STATUSES = [
  CALENDAR_STATUS_PENDING,
  CALENDAR_STATUS_CONNECTED,
  CALENDAR_STATUS_DISCONNECTED,
  CALENDAR_STATUS_EXPIRED,
  CALENDAR_STATUS_ERROR,
  CALENDAR_STATUS_DISABLED,
] as const;

export type CalendarConnectionStatus = (typeof CALENDAR_STATUSES)[number];

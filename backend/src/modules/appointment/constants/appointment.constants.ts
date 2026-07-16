/**
 * Appointment Module Constants
 */

export const APPOINTMENT_ROUTE_PREFIX = '/api/v1/appointments' as const;

// ---------------------------------------------------------------------------
// Appointment Statuses
// ---------------------------------------------------------------------------

export const APPOINTMENT_STATUS_PENDING     = 'pending'     as const;
export const APPOINTMENT_STATUS_CONFIRMED   = 'confirmed'   as const;
export const APPOINTMENT_STATUS_COMPLETED   = 'completed'   as const;
export const APPOINTMENT_STATUS_CANCELLED   = 'cancelled'   as const;
export const APPOINTMENT_STATUS_NO_SHOW     = 'no_show'     as const;
export const APPOINTMENT_STATUS_RESCHEDULED = 'rescheduled' as const;

export const APPOINTMENT_STATUSES = [
  APPOINTMENT_STATUS_PENDING,
  APPOINTMENT_STATUS_CONFIRMED,
  APPOINTMENT_STATUS_COMPLETED,
  APPOINTMENT_STATUS_CANCELLED,
  APPOINTMENT_STATUS_NO_SHOW,
  APPOINTMENT_STATUS_RESCHEDULED,
] as const;

export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];

/** Terminal statuses — no further transitions allowed */
export const TERMINAL_APPOINTMENT_STATUSES: readonly AppointmentStatus[] = [
  APPOINTMENT_STATUS_CANCELLED,
  APPOINTMENT_STATUS_COMPLETED,
  APPOINTMENT_STATUS_NO_SHOW,
];

// ---------------------------------------------------------------------------
// Appointment Sources
// ---------------------------------------------------------------------------

export const APPOINTMENT_SOURCE_AI_VOICE     = 'ai_voice'      as const;
export const APPOINTMENT_SOURCE_DASHBOARD    = 'dashboard'     as const;
export const APPOINTMENT_SOURCE_RECEPTIONIST = 'receptionist'  as const;
export const APPOINTMENT_SOURCE_API          = 'api'           as const;
export const APPOINTMENT_SOURCE_INTEGRATION  = 'integration'   as const;

export const APPOINTMENT_SOURCES = [
  APPOINTMENT_SOURCE_AI_VOICE,
  APPOINTMENT_SOURCE_DASHBOARD,
  APPOINTMENT_SOURCE_RECEPTIONIST,
  APPOINTMENT_SOURCE_API,
  APPOINTMENT_SOURCE_INTEGRATION,
] as const;

export type AppointmentSource = (typeof APPOINTMENT_SOURCES)[number];

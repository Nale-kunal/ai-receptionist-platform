/**
 * Appointment Module Constants
 */

export const APPOINTMENT_ROUTE_PREFIX = '/api/v1/appointments' as const;

// ---------------------------------------------------------------------------
// Appointment Statuses
// ---------------------------------------------------------------------------

export const APPOINTMENT_STATUS_SCHEDULED   = 'scheduled'   as const;
export const APPOINTMENT_STATUS_PENDING     = 'pending'     as const;
export const APPOINTMENT_STATUS_CONFIRMED   = 'confirmed'   as const;
export const APPOINTMENT_STATUS_CHECKED_IN  = 'checked_in'  as const;
export const APPOINTMENT_STATUS_IN_PROGRESS = 'in_progress' as const;
export const APPOINTMENT_STATUS_COMPLETED   = 'completed'   as const;
export const APPOINTMENT_STATUS_CANCELLED   = 'cancelled'   as const;
export const APPOINTMENT_STATUS_NO_SHOW     = 'no_show'     as const;
export const APPOINTMENT_STATUS_RESCHEDULED = 'rescheduled' as const;

export const APPOINTMENT_STATUSES = [
  APPOINTMENT_STATUS_SCHEDULED,
  APPOINTMENT_STATUS_PENDING,
  APPOINTMENT_STATUS_CONFIRMED,
  APPOINTMENT_STATUS_CHECKED_IN,
  APPOINTMENT_STATUS_IN_PROGRESS,
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
export const APPOINTMENT_SOURCE_WHATSAPP     = 'whatsapp'      as const;
export const APPOINTMENT_SOURCE_DASHBOARD    = 'dashboard'     as const;
export const APPOINTMENT_SOURCE_RECEPTIONIST = 'receptionist'  as const;
export const APPOINTMENT_SOURCE_API          = 'api'           as const;
export const APPOINTMENT_SOURCE_INTEGRATION  = 'integration'   as const;

export const APPOINTMENT_SOURCES = [
  APPOINTMENT_SOURCE_AI_VOICE,
  APPOINTMENT_SOURCE_WHATSAPP,
  APPOINTMENT_SOURCE_DASHBOARD,
  APPOINTMENT_SOURCE_RECEPTIONIST,
  APPOINTMENT_SOURCE_API,
  APPOINTMENT_SOURCE_INTEGRATION,
] as const;

export type AppointmentSource = (typeof APPOINTMENT_SOURCES)[number];

// ---------------------------------------------------------------------------
// Canonical Dental Appointment Reasons
// ---------------------------------------------------------------------------

export const APPOINTMENT_REASON_ROUTINE_CHECKUP        = 'routine_checkup'        as const;
export const APPOINTMENT_REASON_CLEANING               = 'cleaning'               as const;
export const APPOINTMENT_REASON_TOOTH_PAIN             = 'tooth_pain'             as const;
export const APPOINTMENT_REASON_EMERGENCY              = 'emergency'              as const;
export const APPOINTMENT_REASON_CONSULTATION           = 'consultation'           as const;
export const APPOINTMENT_REASON_TOOTH_SENSITIVITY      = 'tooth_sensitivity'      as const;
export const APPOINTMENT_REASON_CAVITY                 = 'cavity'                 as const;
export const APPOINTMENT_REASON_FILLING                = 'filling'                as const;
export const APPOINTMENT_REASON_CROWN_BRIDGE           = 'crown_bridge'           as const;
export const APPOINTMENT_REASON_ROOT_CANAL             = 'root_canal'             as const;
export const APPOINTMENT_REASON_EXTRACTION             = 'extraction'             as const;
export const APPOINTMENT_REASON_WISDOM_TOOTH           = 'wisdom_tooth'           as const;
export const APPOINTMENT_REASON_GUM_PROBLEM            = 'gum_problem'            as const;
export const APPOINTMENT_REASON_BROKEN_TOOTH           = 'broken_tooth'           as const;
export const APPOINTMENT_REASON_IMPLANT_CONSULTATION   = 'implant_consultation'   as const;
export const APPOINTMENT_REASON_DENTURE                = 'denture'                as const;
export const APPOINTMENT_REASON_ORTHODONTIC            = 'orthodontic'            as const;
export const APPOINTMENT_REASON_COSMETIC               = 'cosmetic'               as const;
export const APPOINTMENT_REASON_FOLLOW_UP              = 'follow_up'              as const;
export const APPOINTMENT_REASON_POST_TREATMENT_REVIEW  = 'post_treatment_review'  as const;
export const APPOINTMENT_REASON_OTHER                  = 'other'                  as const;

export const CANONICAL_APPOINTMENT_REASONS = [
  APPOINTMENT_REASON_ROUTINE_CHECKUP,
  APPOINTMENT_REASON_CLEANING,
  APPOINTMENT_REASON_TOOTH_PAIN,
  APPOINTMENT_REASON_EMERGENCY,
  APPOINTMENT_REASON_CONSULTATION,
  APPOINTMENT_REASON_TOOTH_SENSITIVITY,
  APPOINTMENT_REASON_CAVITY,
  APPOINTMENT_REASON_FILLING,
  APPOINTMENT_REASON_CROWN_BRIDGE,
  APPOINTMENT_REASON_ROOT_CANAL,
  APPOINTMENT_REASON_EXTRACTION,
  APPOINTMENT_REASON_WISDOM_TOOTH,
  APPOINTMENT_REASON_GUM_PROBLEM,
  APPOINTMENT_REASON_BROKEN_TOOTH,
  APPOINTMENT_REASON_IMPLANT_CONSULTATION,
  APPOINTMENT_REASON_DENTURE,
  APPOINTMENT_REASON_ORTHODONTIC,
  APPOINTMENT_REASON_COSMETIC,
  APPOINTMENT_REASON_FOLLOW_UP,
  APPOINTMENT_REASON_POST_TREATMENT_REVIEW,
  APPOINTMENT_REASON_OTHER,
] as const;

/** Legacy backward-compatible appointment type aliases */
export const LEGACY_APPOINTMENT_REASON_ALIASES = [
  'checkup',
  'whitening',
  'orthodontics',
] as const;

export const REASON_ALIAS_MAP: Record<string, string> = {
  checkup: APPOINTMENT_REASON_ROUTINE_CHECKUP,
  whitening: APPOINTMENT_REASON_COSMETIC,
  orthodontics: APPOINTMENT_REASON_ORTHODONTIC,
};

export const ALL_ALLOWED_APPOINTMENT_REASONS = [
  ...CANONICAL_APPOINTMENT_REASONS,
  ...LEGACY_APPOINTMENT_REASON_ALIASES,
] as const;

export type AppointmentReasonCode = (typeof CANONICAL_APPOINTMENT_REASONS)[number];

export const APPOINTMENT_REASON_LABELS: Record<string, string> = {
  [APPOINTMENT_REASON_ROUTINE_CHECKUP]: 'Routine Check-up / Dental Examination',
  [APPOINTMENT_REASON_CLEANING]: 'Dental Cleaning / Hygiene',
  [APPOINTMENT_REASON_TOOTH_PAIN]: 'Tooth Pain / Toothache',
  [APPOINTMENT_REASON_EMERGENCY]: 'Dental Emergency',
  [APPOINTMENT_REASON_CONSULTATION]: 'Consultation',
  [APPOINTMENT_REASON_TOOTH_SENSITIVITY]: 'Tooth Sensitivity',
  [APPOINTMENT_REASON_CAVITY]: 'Cavity / Tooth Decay',
  [APPOINTMENT_REASON_FILLING]: 'Filling',
  [APPOINTMENT_REASON_CROWN_BRIDGE]: 'Crown / Bridge',
  [APPOINTMENT_REASON_ROOT_CANAL]: 'Root Canal Treatment',
  [APPOINTMENT_REASON_EXTRACTION]: 'Tooth Extraction',
  [APPOINTMENT_REASON_WISDOM_TOOTH]: 'Wisdom Tooth Consultation',
  [APPOINTMENT_REASON_GUM_PROBLEM]: 'Gum / Periodontal Problem',
  [APPOINTMENT_REASON_BROKEN_TOOTH]: 'Broken / Chipped Tooth',
  [APPOINTMENT_REASON_IMPLANT_CONSULTATION]: 'Dental Implant Consultation',
  [APPOINTMENT_REASON_DENTURE]: 'Denture Consultation / Adjustment',
  [APPOINTMENT_REASON_ORTHODONTIC]: 'Orthodontic Consultation',
  [APPOINTMENT_REASON_COSMETIC]: 'Cosmetic Dentistry Consultation',
  [APPOINTMENT_REASON_FOLLOW_UP]: 'Follow-up Appointment',
  [APPOINTMENT_REASON_POST_TREATMENT_REVIEW]: 'Post-Treatment Review',
  [APPOINTMENT_REASON_OTHER]: 'Other',
  // Legacy aliases
  checkup: 'Routine Check-up / Dental Examination',
  whitening: 'Teeth Whitening',
  orthodontics: 'Orthodontic Consultation',
};

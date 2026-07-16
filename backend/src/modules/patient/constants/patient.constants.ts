/**
 * Patient Module Constants
 */

export const PATIENT_ROUTE_PREFIX = '/api/v1/patients' as const;

// Patient statuses
export const PATIENT_STATUS_ACTIVE = 'active' as const;
export const PATIENT_STATUS_INACTIVE = 'inactive' as const;
export const PATIENT_STATUS_BLOCKED = 'blocked' as const;
export const PATIENT_STATUS_ARCHIVED = 'archived' as const;
export const PATIENT_STATUS_DELETED = 'deleted' as const;

export const PATIENT_STATUSES = [
  PATIENT_STATUS_ACTIVE,
  PATIENT_STATUS_INACTIVE,
  PATIENT_STATUS_BLOCKED,
  PATIENT_STATUS_ARCHIVED,
  PATIENT_STATUS_DELETED,
] as const;

export type PatientStatus = (typeof PATIENT_STATUSES)[number];

// Contact methods
export const CONTACT_METHOD_SMS = 'sms' as const;
export const CONTACT_METHOD_EMAIL = 'email' as const;
export const CONTACT_METHOD_PHONE = 'phone' as const;

export const CONTACT_METHODS = [
  CONTACT_METHOD_SMS,
  CONTACT_METHOD_EMAIL,
  CONTACT_METHOD_PHONE,
] as const;

export type ContactMethod = (typeof CONTACT_METHODS)[number];

/**
 * Doctor Module Constants
 */

export const DOCTOR_ROUTE_PREFIX = '/api/v1/doctors' as const;

// Doctor statuses
export const DOCTOR_STATUS_ACTIVE = 'active' as const;
export const DOCTOR_STATUS_INACTIVE = 'inactive' as const;
export const DOCTOR_STATUS_UNAVAILABLE = 'unavailable' as const;
export const DOCTOR_STATUS_ARCHIVED = 'archived' as const;
export const DOCTOR_STATUS_DELETED = 'deleted' as const;

export const DOCTOR_STATUSES = [
  DOCTOR_STATUS_ACTIVE,
  DOCTOR_STATUS_INACTIVE,
  DOCTOR_STATUS_UNAVAILABLE,
  DOCTOR_STATUS_ARCHIVED,
  DOCTOR_STATUS_DELETED,
] as const;

export type DoctorStatus = (typeof DOCTOR_STATUSES)[number];

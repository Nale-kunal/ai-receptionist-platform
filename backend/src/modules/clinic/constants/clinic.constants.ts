/**
 * Clinic Module Constants
 *
 * Single source of truth for routing prefixes, statuses and localization defaults.
 */

export const CLINIC_ROUTE_PREFIX = '/api/v1/clinics' as const;

// Lifecycle statuses
export const CLINIC_STATUS_PENDING_SETUP = 'pending_setup' as const;
export const CLINIC_STATUS_ACTIVE = 'active' as const;
export const CLINIC_STATUS_SUSPENDED = 'suspended' as const;
export const CLINIC_STATUS_ARCHIVED = 'archived' as const;
export const CLINIC_STATUS_DELETED = 'deleted' as const;

export const CLINIC_STATUSES = [
  CLINIC_STATUS_PENDING_SETUP,
  CLINIC_STATUS_ACTIVE,
  CLINIC_STATUS_SUSPENDED,
  CLINIC_STATUS_ARCHIVED,
  CLINIC_STATUS_DELETED,
] as const;

export type ClinicStatus = (typeof CLINIC_STATUSES)[number];

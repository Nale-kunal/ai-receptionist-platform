/**
 * RBAC Constants
 *
 * All role names, permission strings, and configuration constants
 * for the Role-Based Access Control module.
 *
 * Permission naming convention (per RBAC Contract §Permission Naming):
 *   resource.action
 *
 * These constants are the single source of truth for all permission names.
 * Consumers MUST import from here — never use raw string literals.
 */

// --------------------------------------------------------------------------
// System Role Names
// --------------------------------------------------------------------------

export const ROLE_SUPER_ADMIN = 'super_admin' as const;
export const ROLE_ADMIN = 'admin' as const;
export const ROLE_RECEPTIONIST = 'receptionist' as const;
export const ROLE_DOCTOR = 'doctor' as const;
export const ROLE_PATIENT = 'patient' as const;

/** All built-in system role names — cannot be deleted */
export const SYSTEM_ROLES = [
  ROLE_SUPER_ADMIN,
  ROLE_ADMIN,
  ROLE_RECEPTIONIST,
  ROLE_DOCTOR,
  ROLE_PATIENT,
] as const;

export type SystemRoleName = (typeof SYSTEM_ROLES)[number];

// --------------------------------------------------------------------------
// Permission Names — Clinic
// --------------------------------------------------------------------------

export const PERM_CLINIC_READ = 'clinic.read' as const;
export const PERM_CLINIC_UPDATE = 'clinic.update' as const;
export const PERM_CLINIC_SETTINGS_READ = 'clinic.settings.read' as const;
export const PERM_CLINIC_SETTINGS_UPDATE = 'clinic.settings.update' as const;
export const PERM_CLINIC_DELETE = 'clinic.delete' as const;

// --------------------------------------------------------------------------
// Permission Names — Doctor
// --------------------------------------------------------------------------

export const PERM_DOCTOR_CREATE = 'doctor.create' as const;
export const PERM_DOCTOR_READ = 'doctor.read' as const;
export const PERM_DOCTOR_UPDATE = 'doctor.update' as const;
export const PERM_DOCTOR_DELETE = 'doctor.delete' as const;

// --------------------------------------------------------------------------
// Permission Names — Patient
// --------------------------------------------------------------------------

export const PERM_PATIENT_CREATE = 'patient.create' as const;
export const PERM_PATIENT_READ = 'patient.read' as const;
export const PERM_PATIENT_UPDATE = 'patient.update' as const;
export const PERM_PATIENT_DELETE = 'patient.delete' as const;

// --------------------------------------------------------------------------
// Permission Names — Appointment
// --------------------------------------------------------------------------

export const PERM_APPOINTMENT_CREATE = 'appointment.create' as const;
export const PERM_APPOINTMENT_READ = 'appointment.read' as const;
export const PERM_APPOINTMENT_UPDATE = 'appointment.update' as const;
export const PERM_APPOINTMENT_DELETE = 'appointment.delete' as const;
export const PERM_APPOINTMENT_CANCEL = 'appointment.cancel' as const;
export const PERM_APPOINTMENT_RESCHEDULE = 'appointment.reschedule' as const;

// --------------------------------------------------------------------------
// Permission Names — Conversation
// --------------------------------------------------------------------------

export const PERM_CONVERSATION_READ = 'conversation.read' as const;
export const PERM_CONVERSATION_SUMMARY = 'conversation.summary' as const;
export const PERM_CONVERSATION_DELETE = 'conversation.delete' as const;

// --------------------------------------------------------------------------
// Permission Names — User / Staff
// --------------------------------------------------------------------------

export const PERM_USER_INVITE = 'user.invite' as const;
export const PERM_USER_READ = 'user.read' as const;
export const PERM_USER_UPDATE = 'user.update' as const;
export const PERM_USER_DISABLE = 'user.disable' as const;
export const PERM_USER_DELETE = 'user.delete' as const;

// --------------------------------------------------------------------------
// Permission Names — Notification
// --------------------------------------------------------------------------

export const PERM_NOTIFICATION_READ = 'notification.read' as const;
export const PERM_NOTIFICATION_SEND = 'notification.send' as const;

// --------------------------------------------------------------------------
// Permission Names — Calendar
// --------------------------------------------------------------------------

export const PERM_CALENDAR_READ = 'calendar.read' as const;
export const PERM_CALENDAR_WRITE = 'calendar.write' as const;

// --------------------------------------------------------------------------
// Permission Names — AI / Prompt
// --------------------------------------------------------------------------

export const PERM_AI_CONFIG_READ = 'ai.config.read' as const;
export const PERM_AI_CONFIG_UPDATE = 'ai.config.update' as const;
export const PERM_PROMPT_READ = 'prompt.read' as const;
export const PERM_PROMPT_UPDATE = 'prompt.update' as const;

// --------------------------------------------------------------------------
// Permission Names — Billing / Reporting
// --------------------------------------------------------------------------

export const PERM_REPORT_VIEW = 'report.view' as const;
export const PERM_BILLING_READ = 'billing.read' as const;
export const PERM_BILLING_MANAGE = 'billing.manage' as const;

// --------------------------------------------------------------------------
// Permission Names — Administration (super_admin only)
// --------------------------------------------------------------------------

export const PERM_ADMIN_TENANT_MANAGE = 'admin.tenant.manage' as const;
export const PERM_ADMIN_PLATFORM = 'admin.platform' as const;
export const PERM_RBAC_ROLE_MANAGE = 'rbac.role.manage' as const;
export const PERM_RBAC_PERMISSION_MANAGE = 'rbac.permission.manage' as const;

// --------------------------------------------------------------------------
// All Permission Names (union type for type-safety)
// --------------------------------------------------------------------------

export const ALL_PERMISSIONS = [
  PERM_CLINIC_READ, PERM_CLINIC_UPDATE, PERM_CLINIC_SETTINGS_READ,
  PERM_CLINIC_SETTINGS_UPDATE, PERM_CLINIC_DELETE,
  PERM_DOCTOR_CREATE, PERM_DOCTOR_READ, PERM_DOCTOR_UPDATE, PERM_DOCTOR_DELETE,
  PERM_PATIENT_CREATE, PERM_PATIENT_READ, PERM_PATIENT_UPDATE, PERM_PATIENT_DELETE,
  PERM_APPOINTMENT_CREATE, PERM_APPOINTMENT_READ, PERM_APPOINTMENT_UPDATE,
  PERM_APPOINTMENT_DELETE, PERM_APPOINTMENT_CANCEL, PERM_APPOINTMENT_RESCHEDULE,
  PERM_CONVERSATION_READ, PERM_CONVERSATION_SUMMARY, PERM_CONVERSATION_DELETE,
  PERM_USER_INVITE, PERM_USER_READ, PERM_USER_UPDATE, PERM_USER_DISABLE, PERM_USER_DELETE,
  PERM_NOTIFICATION_READ, PERM_NOTIFICATION_SEND,
  PERM_CALENDAR_READ, PERM_CALENDAR_WRITE,
  PERM_AI_CONFIG_READ, PERM_AI_CONFIG_UPDATE,
  PERM_PROMPT_READ, PERM_PROMPT_UPDATE,
  PERM_REPORT_VIEW, PERM_BILLING_READ, PERM_BILLING_MANAGE,
  PERM_ADMIN_TENANT_MANAGE, PERM_ADMIN_PLATFORM,
  PERM_RBAC_ROLE_MANAGE, PERM_RBAC_PERMISSION_MANAGE,
] as const;

export type PermissionName = (typeof ALL_PERMISSIONS)[number];

// --------------------------------------------------------------------------
// Default Role → Permission Assignments
// --------------------------------------------------------------------------

/** Permissions granted to super_admin (ALL permissions) */
export const SUPER_ADMIN_PERMISSIONS: readonly PermissionName[] = [...ALL_PERMISSIONS];

/** Permissions granted to admin (clinic owner) */
export const ADMIN_PERMISSIONS: readonly PermissionName[] = [
  PERM_CLINIC_READ, PERM_CLINIC_UPDATE, PERM_CLINIC_SETTINGS_READ, PERM_CLINIC_SETTINGS_UPDATE,
  PERM_DOCTOR_CREATE, PERM_DOCTOR_READ, PERM_DOCTOR_UPDATE, PERM_DOCTOR_DELETE,
  PERM_PATIENT_CREATE, PERM_PATIENT_READ, PERM_PATIENT_UPDATE, PERM_PATIENT_DELETE,
  PERM_APPOINTMENT_CREATE, PERM_APPOINTMENT_READ, PERM_APPOINTMENT_UPDATE,
  PERM_APPOINTMENT_DELETE, PERM_APPOINTMENT_CANCEL, PERM_APPOINTMENT_RESCHEDULE,
  PERM_CONVERSATION_READ, PERM_CONVERSATION_SUMMARY,
  PERM_USER_INVITE, PERM_USER_READ, PERM_USER_UPDATE, PERM_USER_DISABLE,
  PERM_NOTIFICATION_READ, PERM_NOTIFICATION_SEND,
  PERM_CALENDAR_READ, PERM_CALENDAR_WRITE,
  PERM_AI_CONFIG_READ, PERM_AI_CONFIG_UPDATE,
  PERM_PROMPT_READ, PERM_PROMPT_UPDATE,
  PERM_REPORT_VIEW, PERM_BILLING_READ,
];

/** Permissions granted to receptionist */
export const RECEPTIONIST_PERMISSIONS: readonly PermissionName[] = [
  PERM_APPOINTMENT_CREATE, PERM_APPOINTMENT_READ, PERM_APPOINTMENT_UPDATE,
  PERM_APPOINTMENT_CANCEL, PERM_APPOINTMENT_RESCHEDULE,
  PERM_PATIENT_READ, PERM_PATIENT_CREATE,
  PERM_CONVERSATION_READ,
  PERM_NOTIFICATION_READ,
  PERM_CALENDAR_READ,
  PERM_DOCTOR_READ,
];

/** Permissions granted to doctor */
export const DOCTOR_PERMISSIONS: readonly PermissionName[] = [
  PERM_APPOINTMENT_READ,
  PERM_PATIENT_READ,
  PERM_CONVERSATION_SUMMARY,
  PERM_CALENDAR_READ,
  PERM_DOCTOR_READ,
];

/** Permissions granted to patient (future) */
export const PATIENT_PERMISSIONS: readonly PermissionName[] = [
  PERM_APPOINTMENT_READ,
  PERM_CONVERSATION_READ,
];

// --------------------------------------------------------------------------
// Cache Configuration
// --------------------------------------------------------------------------

/** Permission cache TTL in seconds (5 minutes) */
export const PERMISSION_CACHE_TTL_SECONDS = 5 * 60;

/** Maximum number of entries in the in-process permission cache */
export const PERMISSION_CACHE_MAX_ENTRIES = 10_000;

// --------------------------------------------------------------------------
// Route Prefix
// --------------------------------------------------------------------------

export const RBAC_ROUTE_PREFIX = '/api/v1/rbac';

// --------------------------------------------------------------------------
// Authorization Outcome Values
// --------------------------------------------------------------------------

export const OUTCOME_GRANTED = 'granted' as const;
export const OUTCOME_DENIED = 'denied' as const;

export type AuthorizationOutcome = typeof OUTCOME_GRANTED | typeof OUTCOME_DENIED;

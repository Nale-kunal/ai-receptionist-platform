/**
 * Canonical Frontend Permission Constants
 *
 * Synchronized 1:1 with Backend RBAC Constants (src/modules/rbac/constants/rbac.constants.ts)
 *
 * Single Source of Truth for frontend permission checks.
 * NEVER use arbitrary strings like '.view' or '.manage' — use these constants.
 */

// Clinic
export const PERM_CLINIC_READ            = 'clinic.read' as const;
export const PERM_CLINIC_UPDATE          = 'clinic.update' as const;
export const PERM_CLINIC_SETTINGS_READ   = 'clinic.settings.read' as const;
export const PERM_CLINIC_SETTINGS_UPDATE = 'clinic.settings.update' as const;

// Doctor
export const PERM_DOCTOR_CREATE = 'doctor.create' as const;
export const PERM_DOCTOR_READ   = 'doctor.read' as const;
export const PERM_DOCTOR_UPDATE = 'doctor.update' as const;
export const PERM_DOCTOR_DELETE = 'doctor.delete' as const;

// Patient
export const PERM_PATIENT_CREATE = 'patient.create' as const;
export const PERM_PATIENT_READ   = 'patient.read' as const;
export const PERM_PATIENT_UPDATE = 'patient.update' as const;
export const PERM_PATIENT_DELETE = 'patient.delete' as const;

// Appointment
export const PERM_APPOINTMENT_CREATE     = 'appointment.create' as const;
export const PERM_APPOINTMENT_READ       = 'appointment.read' as const;
export const PERM_APPOINTMENT_UPDATE     = 'appointment.update' as const;
export const PERM_APPOINTMENT_CANCEL     = 'appointment.cancel' as const;
export const PERM_APPOINTMENT_RESCHEDULE = 'appointment.reschedule' as const;

// Conversation & AI Calls
export const PERM_CONVERSATION_READ    = 'conversation.read' as const;
export const PERM_CONVERSATION_SUMMARY = 'conversation.summary' as const;

// Calendar
export const PERM_CALENDAR_READ  = 'calendar.read' as const;
export const PERM_CALENDAR_WRITE = 'calendar.write' as const;

// Notification
export const PERM_NOTIFICATION_READ = 'notification.read' as const;
export const PERM_NOTIFICATION_SEND = 'notification.send' as const;

// AI & Prompts
export const PERM_AI_CONFIG_READ   = 'ai.config.read' as const;
export const PERM_AI_CONFIG_UPDATE = 'ai.config.update' as const;
export const PERM_PROMPT_READ      = 'prompt.read' as const;
export const PERM_PROMPT_UPDATE    = 'prompt.update' as const;

// FAQ & Knowledge Base
export const PERM_FAQ_CREATE = 'faq.create' as const;
export const PERM_FAQ_READ   = 'faq.read' as const;
export const PERM_FAQ_UPDATE = 'faq.update' as const;
export const PERM_FAQ_DELETE = 'faq.delete' as const;

// Billing & Reports
export const PERM_REPORT_VIEW    = 'report.view' as const;
export const PERM_BILLING_READ   = 'billing.read' as const;
export const PERM_BILLING_MANAGE = 'billing.manage' as const;

// Users & Administration
export const PERM_USER_READ            = 'user.read' as const;
export const PERM_USER_INVITE          = 'user.invite' as const;
export const PERM_USER_UPDATE          = 'user.update' as const;
export const PERM_USER_DELETE          = 'user.delete' as const;
export const PERM_USER_DISABLE         = 'user.disable' as const;
export const PERM_RBAC_ROLE_MANAGE     = 'rbac.role.manage' as const;
export const PERM_ADMIN_TENANT_MANAGE  = 'admin.tenant.manage' as const;
export const PERM_ADMIN_PLATFORM       = 'admin.platform' as const;

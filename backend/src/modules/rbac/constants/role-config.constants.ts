/**
 * Centralized Customer Role Definitions & Permission Maps
 *
 * Single Source of Truth for customer-facing roles.
 * Supports future role expansions (Hygienist, Assistant, Manager, Billing)
 * WITHOUT requiring database schema redesigns or structural code rewrites.
 */

export interface CustomerRoleDef {
  key: string;
  displayName: string;
  description: string;
  isCustomerVisible: boolean;
  defaultPermissions: string[];
}

export const CUSTOMER_ROLES_MAP: Record<string, CustomerRoleDef> = {
  clinic_owner: {
    key: 'clinic_owner',
    displayName: 'Practice Owner',
    description: 'Full administrative control over practice operations, staff team, billing, and system settings.',
    isCustomerVisible: true,
    defaultPermissions: ['*'],
  },
  admin: {
    key: 'admin',
    displayName: 'Practice Owner',
    description: 'Full administrative control over practice operations, staff team, billing, and system settings.',
    isCustomerVisible: false, // Internal alias mapped to Practice Owner
    defaultPermissions: ['*'],
  },
  doctor: {
    key: 'doctor',
    displayName: 'Dentist',
    description: 'Clinical access to appointments, patient records, and practitioner schedule.',
    isCustomerVisible: true,
    defaultPermissions: [
      'appointment.read',
      'appointment.create',
      'appointment.update',
      'appointment.cancel',
      'appointment.reschedule',
      'patient.read',
      'patient.create',
      'patient.update',
      'calendar.read',
      'calendar.write',
      'doctor.read',
    ],
  },
  receptionist: {
    key: 'receptionist',
    displayName: 'Receptionist',
    description: 'Front-desk operations, inbound calls, appointment booking, and AI receptionist status overview.',
    isCustomerVisible: true,
    defaultPermissions: [
      'appointment.read',
      'appointment.create',
      'appointment.update',
      'appointment.cancel',
      'appointment.reschedule',
      'patient.read',
      'patient.create',
      'conversation.read',
      'conversation.summary',
      'calendar.read',
      'calendar.write',
      'ai.config.read',
    ],
  },
};

/**
 * List of allowed customer roles for invitations and role edits
 */
export const ALLOWED_CUSTOMER_ROLES = ['clinic_owner', 'doctor', 'receptionist'] as const;

/**
 * Check if a role is a valid customer role
 */
export function isValidCustomerRole(roleName: string): boolean {
  return (ALLOWED_CUSTOMER_ROLES as readonly string[]).includes(roleName);
}

/**
 * Get human-readable display name for a role key
 */
export function getRoleDisplayName(roleName?: string): string {
  if (!roleName) return 'Staff Member';
  const match = CUSTOMER_ROLES_MAP[roleName];
  if (match) return match.displayName;
  return roleName.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

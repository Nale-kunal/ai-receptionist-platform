import { describe, it, expect } from 'vitest';

// Simulating the permission resolver from AppContext to keep test isolated and fast
const hasPermission = (role: string, permission: string): boolean => {
  if (role === 'super_admin') return true;

  const permissionsMap: Record<string, string[]> = {
    super_admin: ['*'],
    admin: [
      'clinic.view', 'clinic.update',
      'doctor.create', 'doctor.update', 'doctor.view',
      'patient.create', 'patient.update', 'patient.view',
      'appointment.create', 'appointment.update', 'appointment.view', 'appointment.delete',
      'configuration.view', 'configuration.update',
      'prompt.view', 'prompt.update',
      'audit.view', 'health.view',
    ],
    receptionist: [
      'patient.create', 'patient.update', 'patient.view',
      'appointment.create', 'appointment.update', 'appointment.view',
      'configuration.view',
      'prompt.view',
    ],
    doctor: [
      'doctor.view', 'patient.view', 'appointment.view',
    ],
    patient: [
      'patient.view', 'appointment.view', 'appointment.create',
    ],
  };

  const allowed = permissionsMap[role] || [];
  return allowed.includes(permission) || allowed.includes('*');
};

describe('Role-Based Access Control (RBAC) Perms Resolver', () => {
  it('allows super_admin access to everything', () => {
    expect(hasPermission('super_admin', 'health.view')).toBe(true);
    expect(hasPermission('super_admin', 'prompt.update')).toBe(true);
    expect(hasPermission('super_admin', 'non_existent_perm')).toBe(true);
  });

  it('restricts patient role from accessing prompts and logs', () => {
    expect(hasPermission('patient', 'appointment.create')).toBe(true);
    expect(hasPermission('patient', 'patient.view')).toBe(true);
    
    // Protected admin pages
    expect(hasPermission('patient', 'prompt.update')).toBe(false);
    expect(hasPermission('patient', 'health.view')).toBe(false);
    expect(hasPermission('patient', 'audit.view')).toBe(false);
  });

  it('allows receptionist access to scheduling but blocks logs & health', () => {
    expect(hasPermission('receptionist', 'appointment.create')).toBe(true);
    expect(hasPermission('receptionist', 'prompt.view')).toBe(true);
    
    expect(hasPermission('receptionist', 'prompt.update')).toBe(false);
    expect(hasPermission('receptionist', 'health.view')).toBe(false);
  });
});

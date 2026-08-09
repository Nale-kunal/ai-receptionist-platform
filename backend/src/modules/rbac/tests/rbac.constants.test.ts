/**
 * RBAC Constants Tests
 */

import {
  SYSTEM_ROLES,
  ALL_PERMISSIONS,
  SUPER_ADMIN_PERMISSIONS,
  ADMIN_PERMISSIONS,
  RECEPTIONIST_PERMISSIONS,
  DOCTOR_PERMISSIONS,
  PATIENT_PERMISSIONS,
  ROLE_SUPER_ADMIN,
  ROLE_ADMIN,
  ROLE_RECEPTIONIST,
  ROLE_DOCTOR,
  ROLE_PATIENT,
  PERM_APPOINTMENT_CREATE,
  PERM_RBAC_ROLE_MANAGE,
  PERM_RBAC_PERMISSION_MANAGE,
} from '../constants/rbac.constants';

describe('RBAC Constants', () => {
  describe('SYSTEM_ROLES', () => {
    it('should contain system roles including super_admin, admin, receptionist, doctor, patient', () => {
      expect(SYSTEM_ROLES.length).toBeGreaterThanOrEqual(5);
      expect(SYSTEM_ROLES).toContain(ROLE_SUPER_ADMIN);
      expect(SYSTEM_ROLES).toContain(ROLE_ADMIN);
      expect(SYSTEM_ROLES).toContain(ROLE_RECEPTIONIST);
      expect(SYSTEM_ROLES).toContain(ROLE_DOCTOR);
      expect(SYSTEM_ROLES).toContain(ROLE_PATIENT);
    });
  });

  describe('Permission naming convention', () => {
    it('all permissions should follow resource.action format', () => {
      const regex = /^[a-z][a-z0-9_-]*(\.[a-z][a-z0-9_-]*)+$/;
      for (const perm of ALL_PERMISSIONS) {
        expect(perm).toMatch(regex);
      }
    });

    it('should have no duplicate permission names', () => {
      const set = new Set(ALL_PERMISSIONS);
      expect(set.size).toBe(ALL_PERMISSIONS.length);
    });
  });

  describe('Role permission sets', () => {
    it('super_admin should have ALL permissions', () => {
      const allSet = new Set(ALL_PERMISSIONS);
      const superSet = new Set(SUPER_ADMIN_PERMISSIONS);
      for (const p of allSet) {
        expect(superSet.has(p)).toBe(true);
      }
    });

    it('super_admin should have rbac.role.manage and rbac.permission.manage', () => {
      expect(SUPER_ADMIN_PERMISSIONS).toContain(PERM_RBAC_ROLE_MANAGE);
      expect(SUPER_ADMIN_PERMISSIONS).toContain(PERM_RBAC_PERMISSION_MANAGE);
    });

    it('super_admin should have rbac.role.manage', () => {
      expect(SUPER_ADMIN_PERMISSIONS).toContain(PERM_RBAC_ROLE_MANAGE);
    });

    it('receptionist should have appointment.create', () => {
      expect(RECEPTIONIST_PERMISSIONS).toContain(PERM_APPOINTMENT_CREATE);
    });

    it('doctor permissions should be a subset of admin permissions', () => {
      const adminSet = new Set(ADMIN_PERMISSIONS);
      for (const p of DOCTOR_PERMISSIONS) {
        expect(adminSet.has(p)).toBe(true);
      }
    });

    it('patient permissions should be fewer than receptionist permissions', () => {
      expect(PATIENT_PERMISSIONS.length).toBeLessThan(RECEPTIONIST_PERMISSIONS.length);
    });

    it('no role except super_admin should have admin.platform', () => {
      const others = [ADMIN_PERMISSIONS, RECEPTIONIST_PERMISSIONS, DOCTOR_PERMISSIONS, PATIENT_PERMISSIONS];
      for (const perms of others) {
        expect(perms).not.toContain('admin.platform');
      }
    });
  });
});

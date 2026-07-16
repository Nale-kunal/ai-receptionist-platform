/**
 * RBAC Validator Tests
 */

import { CreateRoleSchema } from '../validators/create-role.validator';
import { UpdateRoleSchema } from '../validators/update-role.validator';
import { AssignRoleSchema } from '../validators/assign-role.validator';
import { CreatePermissionSchema } from '../validators/create-permission.validator';
import { AssignPermissionSchema } from '../validators/assign-permission.validator';

describe('RBAC Validators', () => {
  // ============================================================
  // CreateRoleSchema
  // ============================================================

  describe('CreateRoleSchema', () => {
    it('should accept a valid role creation payload', () => {
      const result = CreateRoleSchema.safeParse({
        name: 'custom_role',
        displayName: 'Custom Role',
        description: 'A test role.',
      });
      expect(result.success).toBe(true);
    });

    it('should accept kebab-case role names', () => {
      const result = CreateRoleSchema.safeParse({ name: 'clinic-manager', displayName: 'Clinic Manager' });
      expect(result.success).toBe(true);
    });

    it('should reject uppercase role names', () => {
      const result = CreateRoleSchema.safeParse({ name: 'CustomRole', displayName: 'Role' });
      expect(result.success).toBe(false);
    });

    it('should reject role names starting with a digit', () => {
      const result = CreateRoleSchema.safeParse({ name: '1admin', displayName: 'Role' });
      expect(result.success).toBe(false);
    });

    it('should reject missing displayName', () => {
      const result = CreateRoleSchema.safeParse({ name: 'custom_role' });
      expect(result.success).toBe(false);
    });

    it('should reject description over 500 characters', () => {
      const result = CreateRoleSchema.safeParse({
        name: 'custom_role',
        displayName: 'Role',
        description: 'x'.repeat(501),
      });
      expect(result.success).toBe(false);
    });
  });

  // ============================================================
  // UpdateRoleSchema
  // ============================================================

  describe('UpdateRoleSchema', () => {
    it('should accept partial updates', () => {
      const result = UpdateRoleSchema.safeParse({ displayName: 'New Name' });
      expect(result.success).toBe(true);
    });

    it('should accept isActive toggle', () => {
      const result = UpdateRoleSchema.safeParse({ isActive: false });
      expect(result.success).toBe(true);
    });

    it('should reject an empty update (no fields provided)', () => {
      const result = UpdateRoleSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });

  // ============================================================
  // AssignRoleSchema
  // ============================================================

  describe('AssignRoleSchema', () => {
    it('should accept a valid assignment', () => {
      const result = AssignRoleSchema.safeParse({
        userId: '550e8400-e29b-41d4-a716-446655440000',
        roleId: '550e8400-e29b-41d4-a716-446655440001',
      });
      expect(result.success).toBe(true);
    });

    it('should accept optional clinicId', () => {
      const result = AssignRoleSchema.safeParse({
        userId: '550e8400-e29b-41d4-a716-446655440000',
        roleId: '550e8400-e29b-41d4-a716-446655440001',
        clinicId: '550e8400-e29b-41d4-a716-446655440002',
      });
      expect(result.success).toBe(true);
    });

    it('should reject non-UUID userId', () => {
      const result = AssignRoleSchema.safeParse({ userId: 'not-a-uuid', roleId: '550e8400-e29b-41d4-a716-446655440001' });
      expect(result.success).toBe(false);
    });

    it('should reject missing roleId', () => {
      const result = AssignRoleSchema.safeParse({ userId: '550e8400-e29b-41d4-a716-446655440000' });
      expect(result.success).toBe(false);
    });

    it('should accept optional expiresAt as ISO string', () => {
      const result = AssignRoleSchema.safeParse({
        userId: '550e8400-e29b-41d4-a716-446655440000',
        roleId: '550e8400-e29b-41d4-a716-446655440001',
        expiresAt: '2030-01-01T00:00:00.000Z',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.expiresAt).toBeInstanceOf(Date);
      }
    });
  });

  // ============================================================
  // CreatePermissionSchema
  // ============================================================

  describe('CreatePermissionSchema', () => {
    it('should accept valid resource.action names', () => {
      const valid = ['appointment.create', 'clinic.settings.update', 'user.invite'];
      for (const name of valid) {
        const result = CreatePermissionSchema.safeParse({ name, displayName: 'Test' });
        expect(result.success).toBe(true);
      }
    });

    it('should reject names without a dot separator', () => {
      const result = CreatePermissionSchema.safeParse({ name: 'appointment', displayName: 'Test' });
      expect(result.success).toBe(false);
    });

    it('should reject names with uppercase characters', () => {
      const result = CreatePermissionSchema.safeParse({ name: 'Appointment.Create', displayName: 'Test' });
      expect(result.success).toBe(false);
    });

    it('should reject empty name', () => {
      const result = CreatePermissionSchema.safeParse({ name: '', displayName: 'Test' });
      expect(result.success).toBe(false);
    });

    it('should reject missing displayName', () => {
      const result = CreatePermissionSchema.safeParse({ name: 'appointment.create' });
      expect(result.success).toBe(false);
    });
  });

  // ============================================================
  // AssignPermissionSchema
  // ============================================================

  describe('AssignPermissionSchema', () => {
    it('should accept a valid UUID permissionId', () => {
      const result = AssignPermissionSchema.safeParse({
        permissionId: '550e8400-e29b-41d4-a716-446655440000',
      });
      expect(result.success).toBe(true);
    });

    it('should reject a non-UUID permissionId', () => {
      const result = AssignPermissionSchema.safeParse({ permissionId: 'not-a-uuid' });
      expect(result.success).toBe(false);
    });

    it('should reject missing permissionId', () => {
      const result = AssignPermissionSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });
});

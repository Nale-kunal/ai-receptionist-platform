/**
 * PermissionEvaluatorService Tests
 *
 * Tests the core authorization engine with mocked repositories and cache.
 */

import { PermissionEvaluatorService } from '../services/permission-evaluator.service';
import { PermissionCacheService } from '../services/permission-cache.service';
import {
  ForbiddenError,
  TenantIsolationViolationError,
  ClinicIsolationViolationError,
} from '../errors/rbac.errors';
import type { RbacContext } from '../types/rbac.types';
import {
  PERM_APPOINTMENT_READ,
  PERM_APPOINTMENT_CREATE,
  PERM_CLINIC_UPDATE,
} from '../constants/rbac.constants';
import { InProcessRbacEventPublisher } from '../events/rbac-event.publisher';

// --------------------------------------------------------------------------
// Mocks
// --------------------------------------------------------------------------

const mockUserRoleRepository = {
  findActiveRoleIds: jest.fn(),
  findActiveByUser: jest.fn(),
};

const mockPermissionRepository = {
  findPermissionNamesForRoles: jest.fn(),
};

function makeContext(overrides: Partial<RbacContext> = {}): RbacContext {
  return {
    userId: 'user-id-1',
    tenantId: 'tenant-id-1',
    clinicId: 'clinic-id-1',
    role: 'admin',
    sessionId: 'session-id-1',
    requestId: 'req-id-1',
    ipAddress: '127.0.0.1',
    ...overrides,
  };
}

// --------------------------------------------------------------------------
// Tests
// --------------------------------------------------------------------------

describe('PermissionEvaluatorService', () => {
  let evaluator: PermissionEvaluatorService;
  let cache: PermissionCacheService;
  let publisher: InProcessRbacEventPublisher;

  beforeEach(() => {
    jest.clearAllMocks();
    cache = new PermissionCacheService(300, 100);
    publisher = new InProcessRbacEventPublisher();
    evaluator = new PermissionEvaluatorService(
      mockUserRoleRepository as any,
      mockPermissionRepository as any,
      cache,
      publisher,
      { enableTransitionalFallback: false },
    );
  });

  // ----------------------------------------------------------------
  // authorize — successful grant
  // ----------------------------------------------------------------

  describe('authorize', () => {
    it('should resolve permissions from DB on cache miss and grant access', async () => {
      mockUserRoleRepository.findActiveRoleIds.mockResolvedValue(['role-id-1']);
      mockPermissionRepository.findPermissionNamesForRoles.mockResolvedValue(
        new Set([PERM_APPOINTMENT_READ, PERM_APPOINTMENT_CREATE]),
      );
      mockUserRoleRepository.findActiveByUser.mockResolvedValue([
        { id: 'ur-1', role: { name: 'admin', displayName: 'Admin' }, tenantId: 'tenant-id-1', userId: 'user-id-1', roleId: 'role-id-1', clinicId: null, assignedAt: new Date(), assignedBy: null, expiresAt: null, isActive: true, revokedAt: null },
      ]);

      const context = makeContext();
      const result = await evaluator.authorize({
        context,
        requiredPermission: PERM_APPOINTMENT_READ,
      });

      expect(result.outcome).toBe('granted');
      expect(result.grantedPermissions.has(PERM_APPOINTMENT_READ)).toBe(true);
    });

    it('should use cache on second call (no second DB query)', async () => {
      mockUserRoleRepository.findActiveRoleIds.mockResolvedValue(['role-id-1']);
      mockPermissionRepository.findPermissionNamesForRoles.mockResolvedValue(
        new Set([PERM_APPOINTMENT_READ]),
      );
      mockUserRoleRepository.findActiveByUser.mockResolvedValue([
        { id: 'ur-1', role: { name: 'admin', displayName: 'Admin' }, tenantId: 'tenant-id-1', userId: 'user-id-1', roleId: 'role-id-1', clinicId: null, assignedAt: new Date(), assignedBy: null, expiresAt: null, isActive: true, revokedAt: null },
      ]);

      const context = makeContext();

      await evaluator.authorize({ context, requiredPermission: PERM_APPOINTMENT_READ });
      await evaluator.authorize({ context, requiredPermission: PERM_APPOINTMENT_READ });

      // DB should have been called exactly once (second call uses cache)
      expect(mockUserRoleRepository.findActiveRoleIds).toHaveBeenCalledTimes(1);
    });

    it('should throw ForbiddenError when permission is not granted', async () => {
      mockUserRoleRepository.findActiveRoleIds.mockResolvedValue(['role-id-1']);
      mockPermissionRepository.findPermissionNamesForRoles.mockResolvedValue(
        new Set([PERM_APPOINTMENT_READ]),
      );
      mockUserRoleRepository.findActiveByUser.mockResolvedValue([]);

      const context = makeContext();

      await expect(
        evaluator.authorize({ context, requiredPermission: PERM_CLINIC_UPDATE }),
      ).rejects.toThrow(ForbiddenError);
    });

    it('should throw ForbiddenError when user has no roles', async () => {
      mockUserRoleRepository.findActiveRoleIds.mockResolvedValue([]);
      mockPermissionRepository.findPermissionNamesForRoles.mockResolvedValue(new Set());
      mockUserRoleRepository.findActiveByUser.mockResolvedValue([]);

      const context = makeContext();

      await expect(
        evaluator.authorize({ context, requiredPermission: PERM_APPOINTMENT_READ }),
      ).rejects.toThrow(ForbiddenError);
    });

    it('should throw TenantIsolationViolationError on cross-tenant access', async () => {
      const context = makeContext({ tenantId: 'tenant-id-1' });

      await expect(
        evaluator.authorize({
          context,
          requiredPermission: PERM_APPOINTMENT_READ,
          resourceTenantId: 'tenant-id-DIFFERENT',
        }),
      ).rejects.toThrow(TenantIsolationViolationError);
    });

    it('should throw ClinicIsolationViolationError on cross-clinic access', async () => {
      mockUserRoleRepository.findActiveRoleIds.mockResolvedValue(['role-id-1']);
      mockPermissionRepository.findPermissionNamesForRoles.mockResolvedValue(
        new Set([PERM_APPOINTMENT_READ]),
      );
      mockUserRoleRepository.findActiveByUser.mockResolvedValue([]);

      const context = makeContext({ clinicId: 'clinic-id-A' });

      await expect(
        evaluator.authorize({
          context,
          requiredPermission: PERM_APPOINTMENT_READ,
          resourceClinicId: 'clinic-id-B',
        }),
      ).rejects.toThrow(ClinicIsolationViolationError);
    });

    it('should allow clinic isolation bypass for super_admin (null clinicId)', async () => {
      mockUserRoleRepository.findActiveRoleIds.mockResolvedValue(['role-id-1']);
      mockPermissionRepository.findPermissionNamesForRoles.mockResolvedValue(
        new Set([PERM_APPOINTMENT_READ]),
      );
      mockUserRoleRepository.findActiveByUser.mockResolvedValue([
        { id: 'ur-1', role: { name: 'super_admin', displayName: 'Super Admin' }, tenantId: 'tenant-id-1', userId: 'user-id-1', roleId: 'role-id-1', clinicId: null, assignedAt: new Date(), assignedBy: null, expiresAt: null, isActive: true, revokedAt: null },
      ]);

      // clinicId = null means platform-wide; should not trigger clinic isolation
      const context = makeContext({ clinicId: null });

      const result = await evaluator.authorize({
        context,
        requiredPermission: PERM_APPOINTMENT_READ,
        resourceClinicId: 'any-clinic-id',
      });

      expect(result.outcome).toBe('granted');
    });
  });

  // ----------------------------------------------------------------
  // hasAnyPermission
  // ----------------------------------------------------------------

  describe('hasAnyPermission', () => {
    it('should return true when user has at least one required permission', async () => {
      mockUserRoleRepository.findActiveRoleIds.mockResolvedValue(['role-id-1']);
      mockPermissionRepository.findPermissionNamesForRoles.mockResolvedValue(
        new Set([PERM_APPOINTMENT_READ]),
      );
      mockUserRoleRepository.findActiveByUser.mockResolvedValue([]);

      const result = await evaluator.hasAnyPermission({
        context: makeContext(),
        requiredPermissions: [PERM_APPOINTMENT_READ, PERM_CLINIC_UPDATE],
      });

      expect(result).toBe(true);
    });

    it('should return false when user has none of the required permissions', async () => {
      mockUserRoleRepository.findActiveRoleIds.mockResolvedValue([]);
      mockPermissionRepository.findPermissionNamesForRoles.mockResolvedValue(new Set());
      mockUserRoleRepository.findActiveByUser.mockResolvedValue([]);

      const result = await evaluator.hasAnyPermission({
        context: makeContext(),
        requiredPermissions: [PERM_APPOINTMENT_READ, PERM_CLINIC_UPDATE],
      });

      expect(result).toBe(false);
    });
  });

  // ----------------------------------------------------------------
  // hasAllPermissions
  // ----------------------------------------------------------------

  describe('hasAllPermissions', () => {
    it('should return true when user has all required permissions', async () => {
      mockUserRoleRepository.findActiveRoleIds.mockResolvedValue(['role-id-1']);
      mockPermissionRepository.findPermissionNamesForRoles.mockResolvedValue(
        new Set([PERM_APPOINTMENT_READ, PERM_APPOINTMENT_CREATE]),
      );
      mockUserRoleRepository.findActiveByUser.mockResolvedValue([]);

      const result = await evaluator.hasAllPermissions({
        context: makeContext(),
        requiredPermissions: [PERM_APPOINTMENT_READ, PERM_APPOINTMENT_CREATE],
      });

      expect(result).toBe(true);
    });

    it('should return false when user is missing one permission', async () => {
      mockUserRoleRepository.findActiveRoleIds.mockResolvedValue(['role-id-1']);
      mockPermissionRepository.findPermissionNamesForRoles.mockResolvedValue(
        new Set([PERM_APPOINTMENT_READ]),
      );
      mockUserRoleRepository.findActiveByUser.mockResolvedValue([]);

      const result = await evaluator.hasAllPermissions({
        context: makeContext(),
        requiredPermissions: [PERM_APPOINTMENT_READ, PERM_APPOINTMENT_CREATE],
      });

      expect(result).toBe(false);
    });
  });

  // ----------------------------------------------------------------
  // hasRole
  // ----------------------------------------------------------------

  describe('hasRole', () => {
    it('should return true when resolved roleNames contains the role', async () => {
      mockUserRoleRepository.findActiveRoleIds.mockResolvedValue(['role-id-1']);
      mockPermissionRepository.findPermissionNamesForRoles.mockResolvedValue(new Set());
      mockUserRoleRepository.findActiveByUser.mockResolvedValue([
        { id: 'ur-1', role: { name: 'admin', displayName: 'Admin' }, tenantId: 'tenant-id-1', userId: 'user-id-1', roleId: 'role-id-1', clinicId: null, assignedAt: new Date(), assignedBy: null, expiresAt: null, isActive: true, revokedAt: null },
      ]);

      const result = await evaluator.hasRole(makeContext(), 'admin');
      expect(result).toBe(true);
    });

    it('should return false when role is not assigned', async () => {
      mockUserRoleRepository.findActiveRoleIds.mockResolvedValue([]);
      mockPermissionRepository.findPermissionNamesForRoles.mockResolvedValue(new Set());
      mockUserRoleRepository.findActiveByUser.mockResolvedValue([]);

      const result = await evaluator.hasRole(makeContext(), 'super_admin');
      expect(result).toBe(false);
    });
  });
});

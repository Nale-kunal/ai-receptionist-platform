/**
 * RbacService Tests
 */

import { RbacService } from '../services/rbac.service';
import { PermissionCacheService } from '../services/permission-cache.service';
import { InProcessRbacEventPublisher } from '../events/rbac-event.publisher';
import {
  RoleNotFoundError,
  RoleAlreadyExistsError,
  SystemRoleModificationError,
  RoleAlreadyAssignedError,
  PermissionNotFoundError,
  PermissionAlreadyExistsError,
  PermissionAlreadyGrantedError,
  InvalidPermissionNameError,
} from '../errors/rbac.errors';

// --------------------------------------------------------------------------
// Mock repositories
// --------------------------------------------------------------------------

const mockRoleRepository = {
  create: jest.fn(),
  findById: jest.fn(),
  findByIdWithPermissions: jest.fn(),
  findByName: jest.fn(),
  findMany: jest.fn(),
  update: jest.fn(),
  softDelete: jest.fn(),
  countPermissions: jest.fn(),
};

const mockPermissionRepository = {
  create: jest.fn(),
  findById: jest.fn(),
  findByName: jest.fn(),
  findMany: jest.fn(),
  findByNames: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  grantToRole: jest.fn(),
  revokeFromRole: jest.fn(),
  isGrantedToRole: jest.fn(),
  findPermissionsForRole: jest.fn(),
  findPermissionNamesForRoles: jest.fn(),
};

const mockUserRoleRepository = {
  create: jest.fn(),
  findById: jest.fn(),
  findActiveByUserAndRole: jest.fn(),
  findActiveByUser: jest.fn(),
  findActiveRoleIds: jest.fn(),
  revoke: jest.fn(),
  revokeByUserAndRole: jest.fn(),
  revokeAllByUser: jest.fn(),
};

function makeRole(overrides: Record<string, unknown> = {}) {
  return {
    id: 'role-id-1',
    tenantId: 'tenant-id-1',
    name: 'custom_role',
    displayName: 'Custom Role',
    description: null,
    isSystem: false,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...overrides,
  };
}

function makePermission(overrides: Record<string, unknown> = {}) {
  return {
    id: 'perm-id-1',
    name: 'appointment.create',
    displayName: 'Create Appointment',
    description: null,
    resource: 'appointment',
    action: 'create',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

// --------------------------------------------------------------------------
// Tests
// --------------------------------------------------------------------------

describe('RbacService', () => {
  let service: RbacService;
  let cache: PermissionCacheService;

  beforeEach(() => {
    jest.clearAllMocks();
    cache = new PermissionCacheService(300, 100);
    const publisher = new InProcessRbacEventPublisher();
    service = new RbacService(
      mockRoleRepository as any,
      mockPermissionRepository as any,
      mockUserRoleRepository as any,
      cache,
      publisher,
    );
  });

  // ============================================================
  // createRole
  // ============================================================

  describe('createRole', () => {
    it('should throw RoleAlreadyExistsError when name is taken', async () => {
      mockRoleRepository.findByName.mockResolvedValue(makeRole());

      await expect(
        service.createRole({
          tenantId: 'tenant-id-1',
          name: 'custom_role',
          displayName: 'Custom Role',
          actorId: 'actor-id',
          requestId: 'req-id',
        }),
      ).rejects.toThrow(RoleAlreadyExistsError);
    });

    it('should create a role and return SafeRole on success', async () => {
      mockRoleRepository.findByName.mockResolvedValue(null);
      mockRoleRepository.create.mockResolvedValue(makeRole());

      const result = await service.createRole({
        tenantId: 'tenant-id-1',
        name: 'custom_role',
        displayName: 'Custom Role',
        actorId: 'actor-id',
        requestId: 'req-id',
      });

      expect(result.name).toBe('custom_role');
      expect(result.isSystem).toBe(false);
      expect(result.permissionCount).toBe(0);
    });
  });

  // ============================================================
  // updateRole
  // ============================================================

  describe('updateRole', () => {
    it('should throw RoleNotFoundError when role does not exist', async () => {
      mockRoleRepository.findById.mockResolvedValue(null);

      await expect(
        service.updateRole({
          id: 'nonexistent',
          tenantId: 'tenant-id-1',
          displayName: 'New Name',
          actorId: 'actor-id',
          requestId: 'req-id',
        }),
      ).rejects.toThrow(RoleNotFoundError);
    });

    it('should throw SystemRoleModificationError for system roles', async () => {
      mockRoleRepository.findById.mockResolvedValue(makeRole({ isSystem: true }));

      await expect(
        service.updateRole({
          id: 'role-id-1',
          tenantId: 'tenant-id-1',
          displayName: 'New Name',
          actorId: 'actor-id',
          requestId: 'req-id',
        }),
      ).rejects.toThrow(SystemRoleModificationError);
    });

    it('should update role and invalidate tenant cache', async () => {
      mockRoleRepository.findById.mockResolvedValue(makeRole());
      mockRoleRepository.update.mockResolvedValue(makeRole({ displayName: 'Updated Name' }));
      mockRoleRepository.countPermissions.mockResolvedValue(3);

      const invalidateSpy = jest.spyOn(cache, 'invalidateByTenantId');

      const result = await service.updateRole({
        id: 'role-id-1',
        tenantId: 'tenant-id-1',
        displayName: 'Updated Name',
        actorId: 'actor-id',
        requestId: 'req-id',
      });

      expect(invalidateSpy).toHaveBeenCalledWith('tenant-id-1');
      expect(result.permissionCount).toBe(3);
    });
  });

  // ============================================================
  // deleteRole
  // ============================================================

  describe('deleteRole', () => {
    it('should throw SystemRoleModificationError for system roles', async () => {
      mockRoleRepository.findById.mockResolvedValue(makeRole({ isSystem: true }));

      await expect(
        service.deleteRole({
          id: 'role-id-1',
          tenantId: 'tenant-id-1',
          actorId: 'actor-id',
          requestId: 'req-id',
        }),
      ).rejects.toThrow(SystemRoleModificationError);
    });

    it('should soft-delete the role and invalidate cache', async () => {
      mockRoleRepository.findById.mockResolvedValue(makeRole());
      mockRoleRepository.softDelete.mockResolvedValue(makeRole({ deletedAt: new Date() }));

      const invalidateSpy = jest.spyOn(cache, 'invalidateByTenantId');

      await service.deleteRole({
        id: 'role-id-1',
        tenantId: 'tenant-id-1',
        actorId: 'actor-id',
        requestId: 'req-id',
      });

      expect(invalidateSpy).toHaveBeenCalledWith('tenant-id-1');
      expect(mockRoleRepository.softDelete).toHaveBeenCalledWith('role-id-1');
    });
  });

  // ============================================================
  // createPermission
  // ============================================================

  describe('createPermission', () => {
    it('should throw InvalidPermissionNameError for invalid name', async () => {
      await expect(
        service.createPermission({
          name: 'INVALID_NAME',
          displayName: 'Invalid',
          resource: 'invalid',
          action: 'name',
          actorId: 'actor-id',
          requestId: 'req-id',
        }),
      ).rejects.toThrow(InvalidPermissionNameError);
    });

    it('should throw PermissionAlreadyExistsError for duplicate name', async () => {
      mockPermissionRepository.findByName.mockResolvedValue(makePermission());

      await expect(
        service.createPermission({
          name: 'appointment.create',
          displayName: 'Create Appointment',
          resource: 'appointment',
          action: 'create',
          actorId: 'actor-id',
          requestId: 'req-id',
        }),
      ).rejects.toThrow(PermissionAlreadyExistsError);
    });

    it('should create permission on success', async () => {
      mockPermissionRepository.findByName.mockResolvedValue(null);
      mockPermissionRepository.create.mockResolvedValue(makePermission());

      const result = await service.createPermission({
        name: 'appointment.create',
        displayName: 'Create Appointment',
        resource: 'appointment',
        action: 'create',
        actorId: 'actor-id',
        requestId: 'req-id',
      });

      expect(result.name).toBe('appointment.create');
      expect(result.resource).toBe('appointment');
      expect(result.action).toBe('create');
    });
  });

  // ============================================================
  // grantPermissionToRole
  // ============================================================

  describe('grantPermissionToRole', () => {
    it('should throw RoleNotFoundError when role does not exist', async () => {
      mockRoleRepository.findById.mockResolvedValue(null);
      mockPermissionRepository.findById.mockResolvedValue(makePermission());

      await expect(
        service.grantPermissionToRole({
          roleId: 'nonexistent',
          permissionId: 'perm-id-1',
          tenantId: 'tenant-id-1',
          grantedBy: 'actor-id',
          requestId: 'req-id',
        }),
      ).rejects.toThrow(RoleNotFoundError);
    });

    it('should throw PermissionAlreadyGrantedError when already granted', async () => {
      mockRoleRepository.findById.mockResolvedValue(makeRole());
      mockPermissionRepository.findById.mockResolvedValue(makePermission());
      mockPermissionRepository.isGrantedToRole.mockResolvedValue(true);

      await expect(
        service.grantPermissionToRole({
          roleId: 'role-id-1',
          permissionId: 'perm-id-1',
          tenantId: 'tenant-id-1',
          grantedBy: 'actor-id',
          requestId: 'req-id',
        }),
      ).rejects.toThrow(PermissionAlreadyGrantedError);
    });

    it('should grant permission and invalidate tenant cache', async () => {
      mockRoleRepository.findById.mockResolvedValue(makeRole());
      mockPermissionRepository.findById.mockResolvedValue(makePermission());
      mockPermissionRepository.isGrantedToRole.mockResolvedValue(false);
      mockPermissionRepository.grantToRole.mockResolvedValue(undefined);

      const invalidateSpy = jest.spyOn(cache, 'invalidateByTenantId');

      await service.grantPermissionToRole({
        roleId: 'role-id-1',
        permissionId: 'perm-id-1',
        tenantId: 'tenant-id-1',
        grantedBy: 'actor-id',
        requestId: 'req-id',
      });

      expect(invalidateSpy).toHaveBeenCalledWith('tenant-id-1');
    });
  });

  // ============================================================
  // assignRoleToUser
  // ============================================================

  describe('assignRoleToUser', () => {
    it('should throw RoleAlreadyAssignedError when role already active', async () => {
      mockRoleRepository.findById.mockResolvedValue(makeRole());
      mockUserRoleRepository.findActiveByUserAndRole.mockResolvedValue({ id: 'ur-1' });

      await expect(
        service.assignRoleToUser({
          userId: 'user-id-1',
          roleId: 'role-id-1',
          tenantId: 'tenant-id-1',
          assignedBy: 'actor-id',
          requestId: 'req-id',
        }),
      ).rejects.toThrow(RoleAlreadyAssignedError);
    });

    it('should assign role and invalidate user cache', async () => {
      mockRoleRepository.findById.mockResolvedValue(makeRole());
      mockUserRoleRepository.findActiveByUserAndRole.mockResolvedValue(null);
      mockUserRoleRepository.create.mockResolvedValue({
        id: 'ur-new',
        userId: 'user-id-1',
        roleId: 'role-id-1',
        tenantId: 'tenant-id-1',
        clinicId: null,
        assignedAt: new Date(),
        assignedBy: 'actor-id',
        expiresAt: null,
        revokedAt: null,
        isActive: true,
      });

      const invalidateSpy = jest.spyOn(cache, 'invalidateByUserId');

      const result = await service.assignRoleToUser({
        userId: 'user-id-1',
        roleId: 'role-id-1',
        tenantId: 'tenant-id-1',
        assignedBy: 'actor-id',
        requestId: 'req-id',
      });

      expect(invalidateSpy).toHaveBeenCalledWith('user-id-1');
      expect(result.roleName).toBe('custom_role');
      expect(result.isActive).toBe(true);
    });
  });

  // ============================================================
  // getRoleById (tenant isolation)
  // ============================================================

  describe('getRoleById — tenant isolation', () => {
    it('should throw RoleNotFoundError when role belongs to different tenant', async () => {
      mockRoleRepository.findByIdWithPermissions.mockResolvedValue({
        ...makeRole({ tenantId: 'tenant-OTHER' }),
        isSystem: false,
        rolePermissions: [],
      });

      await expect(
        service.getRoleById('role-id-1', 'tenant-id-1'),
      ).rejects.toThrow(RoleNotFoundError);
    });

    it('should allow access to system roles from any tenant', async () => {
      mockRoleRepository.findByIdWithPermissions.mockResolvedValue({
        ...makeRole({ tenantId: null, isSystem: true }),
        rolePermissions: [],
      });

      const result = await service.getRoleById('role-id-1', 'tenant-id-1');
      expect(result.isSystem).toBe(true);
    });
  });
});

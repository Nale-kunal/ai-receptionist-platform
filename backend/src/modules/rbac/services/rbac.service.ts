/**
 * RBAC Service
 *
 * Business logic for role management, permission management, and role/permission
 * assignment. Coordinates between repositories, cache invalidation, and audit
 * event publishing.
 *
 * Per Engineering Constitution Principle 11: Business rules live in services.
 * Per RBAC Contract §Role Changes: changes require admin permission + audit log
 * + cache invalidation + immediate effect.
 */

import type { RoleRepository } from '../repositories/role.repository';
import type { PermissionRepository } from '../repositories/permission.repository';
import type { UserRoleRepository } from '../repositories/user-role.repository';
import type { PermissionCacheService } from './permission-cache.service';
import type { RbacEventPublisher } from '../events/rbac-event.publisher';
import type { IRbacService } from '../interfaces/rbac.interfaces';
import type {
  CreateRoleParams,
  UpdateRoleParams,
  DeleteRoleParams,
  ListRolesParams,
  CreatePermissionParams,
  UpdatePermissionParams,
  ListPermissionsParams,
  GrantPermissionParams,
  RevokePermissionParams,
  AssignRoleParams,
  RevokeRoleParams,
} from '../interfaces/rbac.interfaces';
import type { SafeRole, SafePermission, SafeUserRole } from '../types/rbac.types';
import {
  RoleNotFoundError,
  RoleAlreadyExistsError,
  SystemRoleModificationError,
  RoleAlreadyAssignedError,
  RoleNotAssignedError,
  PermissionNotFoundError,
  PermissionAlreadyExistsError,
  PermissionAlreadyGrantedError,
  InvalidPermissionNameError,
} from '../errors/rbac.errors';
import type { Role, Permission } from '@prisma/client';

// --------------------------------------------------------------------------
// Private constant — permission name regex
// Same format as the validator but local to the service to avoid circular dep.
// --------------------------------------------------------------------------
const PERMISSION_NAME_REGEX = /^[a-z][a-z0-9_-]*(\.[a-z][a-z0-9_-]*)+$/;

// --------------------------------------------------------------------------
// Mapping helpers (Prisma models → safe public types)
// --------------------------------------------------------------------------

function toSafeRole(role: Role, permissionCount: number): SafeRole {
  return {
    id: role.id,
    tenantId: role.tenantId,
    name: role.name,
    displayName: role.displayName,
    description: role.description,
    isSystem: role.isSystem,
    isActive: role.isActive,
    permissionCount,
    createdAt: role.createdAt,
    updatedAt: role.updatedAt,
  };
}

function toSafePermission(p: Permission): SafePermission {
  return {
    id: p.id,
    name: p.name,
    displayName: p.displayName,
    description: p.description,
    resource: p.resource,
    action: p.action,
    isActive: p.isActive,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

// --------------------------------------------------------------------------
// Service
// --------------------------------------------------------------------------

export class RbacService implements IRbacService {
  constructor(
    private readonly roleRepository: RoleRepository,
    private readonly permissionRepository: PermissionRepository,
    private readonly userRoleRepository: UserRoleRepository,
    private readonly cache: PermissionCacheService,
    private readonly eventPublisher: RbacEventPublisher,
  ) {}

  // ============================================================
  // Role Management
  // ============================================================

  async createRole(params: CreateRoleParams): Promise<SafeRole> {
    // Check uniqueness within tenant
    const existing = await this.roleRepository.findByName(params.name, params.tenantId);
    if (existing) throw new RoleAlreadyExistsError();

    const role = await this.roleRepository.create({
      tenantId: params.tenantId,
      name: params.name,
      displayName: params.displayName,
      description: params.description,
      isSystem: false,
    });

    void this.eventPublisher.publish({
      eventType: 'rbac.role.created',
      occurredAt: new Date(),
      requestId: params.requestId,
      tenantId: params.tenantId,
      actorId: params.actorId,
      ipAddress: 'internal',
      roleId: role.id,
      roleName: role.name,
      isSystem: false,
    });

    return toSafeRole(role, 0);
  }

  async updateRole(params: UpdateRoleParams): Promise<SafeRole> {
    const existing = await this.roleRepository.findById(params.id);
    if (!existing || existing.deletedAt !== null) throw new RoleNotFoundError();
    if (existing.isSystem) throw new SystemRoleModificationError();

    const changes: Record<string, unknown> = {};
    if (params.displayName !== undefined) changes['displayName'] = params.displayName;
    if (params.description !== undefined) changes['description'] = params.description;
    if (params.isActive !== undefined) changes['isActive'] = params.isActive;

    const updated = await this.roleRepository.update(params.id, changes);

    if (params.tenantId) {
      this.cache.invalidateByTenantId(params.tenantId);
    } else {
      this.cache.clear();
    }

    void this.eventPublisher.publish({
      eventType: 'rbac.role.updated',
      occurredAt: new Date(),
      requestId: params.requestId,
      tenantId: params.tenantId,
      actorId: params.actorId,
      ipAddress: 'internal',
      roleId: updated.id,
      roleName: updated.name,
      changes,
    });

    const count = await this.roleRepository.countPermissions(updated.id);
    return toSafeRole(updated, count);
  }

  async deleteRole(params: DeleteRoleParams): Promise<void> {
    const existing = await this.roleRepository.findById(params.id);
    if (!existing || existing.deletedAt !== null) throw new RoleNotFoundError();
    if (existing.isSystem) throw new SystemRoleModificationError();

    await this.roleRepository.softDelete(params.id);

    if (params.tenantId) {
      this.cache.invalidateByTenantId(params.tenantId);
    } else {
      this.cache.clear();
    }

    void this.eventPublisher.publish({
      eventType: 'rbac.role.deleted',
      occurredAt: new Date(),
      requestId: params.requestId,
      tenantId: params.tenantId,
      actorId: params.actorId,
      ipAddress: 'internal',
      roleId: existing.id,
      roleName: existing.name,
    });
  }

  async getRoleById(id: string, tenantId: string | null): Promise<SafeRole> {
    const role = await this.roleRepository.findByIdWithPermissions(id);
    if (!role || role.deletedAt !== null) throw new RoleNotFoundError();

    if (!role.isSystem && tenantId !== null && role.tenantId !== tenantId) {
      throw new RoleNotFoundError();
    }

    const count = role.rolePermissions.length;
    return toSafeRole(role, count);
  }

  async listRoles(params: ListRolesParams): Promise<SafeRole[]> {
    const roles = await this.roleRepository.findMany({
      tenantId: params.tenantId ?? undefined,
      includeSystem: params.includeSystem ?? true,
      activeOnly: params.activeOnly ?? false,
    });

    const result: SafeRole[] = [];
    for (const role of roles) {
      const count = await this.roleRepository.countPermissions(role.id);
      result.push(toSafeRole(role, count));
    }
    return result;
  }

  // ============================================================
  // Permission Management
  // ============================================================

  async createPermission(params: CreatePermissionParams): Promise<SafePermission> {
    if (!PERMISSION_NAME_REGEX.test(params.name)) {
      throw new InvalidPermissionNameError();
    }

    const existing = await this.permissionRepository.findByName(params.name);
    if (existing) throw new PermissionAlreadyExistsError();

    const parts = params.name.split('.');
    const resource = params.resource || parts.slice(0, -1).join('.');
    const action = (params.action || parts[parts.length - 1]) ?? 'unknown';

    const permission = await this.permissionRepository.create({
      name: params.name,
      displayName: params.displayName,
      description: params.description,
      resource,
      action,
    });

    void this.eventPublisher.publish({
      eventType: 'rbac.permission.created',
      occurredAt: new Date(),
      requestId: params.requestId,
      tenantId: null,
      actorId: params.actorId,
      ipAddress: 'internal',
      permissionId: permission.id,
      permissionName: permission.name,
    });

    return toSafePermission(permission);
  }

  async updatePermission(params: UpdatePermissionParams): Promise<SafePermission> {
    const existing = await this.permissionRepository.findById(params.id);
    if (!existing) throw new PermissionNotFoundError();

    const changes: Record<string, unknown> = {};
    if (params.displayName !== undefined) changes['displayName'] = params.displayName;
    if (params.description !== undefined) changes['description'] = params.description;
    if (params.isActive !== undefined) changes['isActive'] = params.isActive;

    const updated = await this.permissionRepository.update(params.id, changes);

    this.cache.clear();

    void this.eventPublisher.publish({
      eventType: 'rbac.permission.updated',
      occurredAt: new Date(),
      requestId: params.requestId,
      tenantId: null,
      actorId: params.actorId,
      ipAddress: 'internal',
      permissionId: updated.id,
      permissionName: updated.name,
      changes,
    });

    return toSafePermission(updated);
  }

  async deletePermission(id: string, actorId: string): Promise<void> {
    const existing = await this.permissionRepository.findById(id);
    if (!existing) throw new PermissionNotFoundError();

    await this.permissionRepository.delete(id);

    this.cache.clear();

    void this.eventPublisher.publish({
      eventType: 'rbac.permission.deleted',
      occurredAt: new Date(),
      requestId: 'system',
      tenantId: null,
      actorId,
      ipAddress: 'internal',
      permissionId: id,
      permissionName: existing.name,
    });
  }

  async getPermissionById(id: string): Promise<SafePermission> {
    const p = await this.permissionRepository.findById(id);
    if (!p) throw new PermissionNotFoundError();
    return toSafePermission(p);
  }

  async listPermissions(params: ListPermissionsParams): Promise<SafePermission[]> {
    const permissions = await this.permissionRepository.findMany(params);
    return permissions.map(toSafePermission);
  }

  // ============================================================
  // Role ↔ Permission Assignment
  // ============================================================

  async grantPermissionToRole(params: GrantPermissionParams): Promise<void> {
    const [role, permission] = await Promise.all([
      this.roleRepository.findById(params.roleId),
      this.permissionRepository.findById(params.permissionId),
    ]);

    if (!role || role.deletedAt !== null) throw new RoleNotFoundError();
    if (!permission) throw new PermissionNotFoundError();

    const alreadyGranted = await this.permissionRepository.isGrantedToRole(
      params.roleId,
      params.permissionId,
    );
    if (alreadyGranted) throw new PermissionAlreadyGrantedError();

    await this.permissionRepository.grantToRole(
      params.roleId,
      params.permissionId,
      params.grantedBy,
    );

    if (params.tenantId) {
      this.cache.invalidateByTenantId(params.tenantId);
    } else {
      this.cache.clear();
    }

    void this.eventPublisher.publish({
      eventType: 'rbac.permission.granted',
      occurredAt: new Date(),
      requestId: params.requestId,
      tenantId: params.tenantId,
      actorId: params.grantedBy,
      ipAddress: 'internal',
      roleId: role.id,
      roleName: role.name,
      permissionId: permission.id,
      permissionName: permission.name,
    });
  }

  async revokePermissionFromRole(params: RevokePermissionParams): Promise<void> {
    const [role, permission] = await Promise.all([
      this.roleRepository.findById(params.roleId),
      this.permissionRepository.findById(params.permissionId),
    ]);

    if (!role || role.deletedAt !== null) throw new RoleNotFoundError();
    if (!permission) throw new PermissionNotFoundError();

    await this.permissionRepository.revokeFromRole(params.roleId, params.permissionId);

    if (params.tenantId) {
      this.cache.invalidateByTenantId(params.tenantId);
    } else {
      this.cache.clear();
    }

    void this.eventPublisher.publish({
      eventType: 'rbac.permission.revoked',
      occurredAt: new Date(),
      requestId: params.requestId,
      tenantId: params.tenantId,
      actorId: params.actorId,
      ipAddress: 'internal',
      roleId: role.id,
      roleName: role.name,
      permissionId: permission.id,
      permissionName: permission.name,
    });
  }

  // ============================================================
  // User ↔ Role Assignment
  // ============================================================

  async assignRoleToUser(params: AssignRoleParams): Promise<SafeUserRole> {
    const role = await this.roleRepository.findById(params.roleId);
    if (!role || role.deletedAt !== null) throw new RoleNotFoundError();

    const existing = await this.userRoleRepository.findActiveByUserAndRole(
      params.userId,
      params.roleId,
      params.tenantId,
    );
    if (existing) throw new RoleAlreadyAssignedError();

    const userRole = await this.userRoleRepository.create({
      userId: params.userId,
      roleId: params.roleId,
      tenantId: params.tenantId,
      clinicId: params.clinicId,
      assignedBy: params.assignedBy,
      expiresAt: params.expiresAt,
    });

    this.cache.invalidateByUserId(params.userId);

    void this.eventPublisher.publish({
      eventType: 'rbac.role.assigned',
      occurredAt: new Date(),
      requestId: params.requestId,
      tenantId: params.tenantId,
      actorId: params.assignedBy,
      ipAddress: 'internal',
      userId: params.userId,
      roleId: role.id,
      roleName: role.name,
      clinicId: params.clinicId ?? null,
    });

    return {
      id: userRole.id,
      userId: userRole.userId,
      roleId: userRole.roleId,
      roleName: role.name,
      roleDisplayName: role.displayName,
      tenantId: userRole.tenantId,
      clinicId: userRole.clinicId,
      assignedAt: userRole.assignedAt,
      assignedBy: userRole.assignedBy,
      expiresAt: userRole.expiresAt,
      isActive: userRole.isActive,
    };
  }

  async revokeRoleFromUser(params: RevokeRoleParams): Promise<void> {
    const role = await this.roleRepository.findById(params.roleId);
    if (!role || role.deletedAt !== null) throw new RoleNotFoundError();

    const count = await this.userRoleRepository.revokeByUserAndRole(
      params.userId,
      params.roleId,
      params.tenantId,
    );

    if (count === 0) throw new RoleNotAssignedError();

    this.cache.invalidateByUserId(params.userId);

    void this.eventPublisher.publish({
      eventType: 'rbac.role.revoked',
      occurredAt: new Date(),
      requestId: params.requestId,
      tenantId: params.tenantId,
      actorId: params.actorId,
      ipAddress: 'internal',
      userId: params.userId,
      roleId: role.id,
      roleName: role.name,
    });
  }

  async getUserRoles(userId: string, tenantId: string): Promise<SafeUserRole[]> {
    const rows = await this.userRoleRepository.findActiveByUser(userId, tenantId);
    return rows.map((ur) => ({
      id: ur.id,
      userId: ur.userId,
      roleId: ur.roleId,
      roleName: ur.role.name,
      roleDisplayName: ur.role.displayName,
      tenantId: ur.tenantId,
      clinicId: ur.clinicId,
      assignedAt: ur.assignedAt,
      assignedBy: ur.assignedBy,
      expiresAt: ur.expiresAt,
      isActive: ur.isActive,
    }));
  }
}

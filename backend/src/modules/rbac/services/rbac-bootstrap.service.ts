/**
 * RBAC Bootstrap Service
 *
 * Provides utilities for seeding system permissions & roles into the database
 * and automatically assigning system roles into the user_roles table upon registration.
 */

import type { PrismaClient } from '@prisma/client';
import type { RoleRepository } from '../repositories/role.repository';
import type { PermissionRepository } from '../repositories/permission.repository';
import type { UserRoleRepository } from '../repositories/user-role.repository';
import type { PermissionCacheService } from './permission-cache.service';
import {
  ALL_PERMISSIONS,
  SYSTEM_ROLES,
  SYSTEM_ROLE_PERMISSIONS_MAP,
  ROLE_CLINIC_OWNER,
  ROLE_ADMIN,
} from '../constants/rbac.constants';

export class RbacBootstrapService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly roleRepository: RoleRepository,
    private readonly permissionRepository: PermissionRepository,
    private readonly userRoleRepository: UserRoleRepository,
    private readonly cache: PermissionCacheService,
  ) {}

  /**
   * Ensures all system permissions, system roles, and role_permissions are seeded in PostgreSQL.
   * Can be called per-tenant or during initial platform startup.
   */
  public async ensureSystemRolesAndPermissions(tenantId: string | null = null): Promise<Record<string, string>> {
    // Step 1 — Bulk seed permissions
    const existingPerms = await this.prisma.permission.findMany();
    const existingPermNames = new Set(existingPerms.map((p) => p.name));
    const missingPerms = ALL_PERMISSIONS.filter((p) => !existingPermNames.has(p));

    if (missingPerms.length > 0) {
      await this.prisma.permission.createMany({
        data: missingPerms.map((permName) => {
          const parts = permName.split('.');
          const resource = parts[0] || 'system';
          const action = parts.slice(1).join('.');
          return {
            name: permName,
            resource,
            action,
            displayName: permName,
            description: `Permission for ${resource} ${action}`,
            isActive: true,
          };
        }),
        skipDuplicates: true,
      });
    }

    const allPerms = await this.prisma.permission.findMany();
    const permissionIdMap: Record<string, string> = {};
    for (const p of allPerms) {
      permissionIdMap[p.name] = p.id;
    }

    // Step 2 — Bulk seed system roles
    const existingRoles = await this.prisma.role.findMany({
      where: { tenantId: tenantId ?? null, deletedAt: null },
    });
    const existingRoleNames = new Set(existingRoles.map((r) => r.name));
    const missingRoles = SYSTEM_ROLES.filter((r) => !existingRoleNames.has(r));

    if (missingRoles.length > 0) {
      await this.prisma.role.createMany({
        data: missingRoles.map((roleName) => ({
          tenantId: tenantId ?? null,
          name: roleName,
          displayName: roleName.replace(/_/g, ' ').toUpperCase(),
          description: `System role for ${roleName}`,
          isSystem: true,
          isActive: true,
        })),
        skipDuplicates: true,
      });
    }

    const allRoles = await this.prisma.role.findMany({
      where: { tenantId: tenantId ?? null, deletedAt: null },
    });
    const roleIdMap: Record<string, string> = {};
    for (const r of allRoles) {
      roleIdMap[r.name] = r.id;
    }

    // Step 3 — Bulk seed role permissions
    const rolePermissionData: Array<{ roleId: string; permissionId: string }> = [];
    for (const roleName of SYSTEM_ROLES) {
      const roleId = roleIdMap[roleName];
      if (!roleId) continue;
      const grantedPerms = SYSTEM_ROLE_PERMISSIONS_MAP[roleName] || [];
      for (const permName of grantedPerms) {
        const permId = permissionIdMap[permName];
        if (permId) {
          rolePermissionData.push({ roleId, permissionId: permId });
        }
      }
    }

    if (rolePermissionData.length > 0) {
      await this.prisma.rolePermission.createMany({
        data: rolePermissionData,
        skipDuplicates: true,
      });
    }

    return roleIdMap;
  }

  /**
   * Automatically assigns a system role (e.g. clinic_owner, admin, receptionist) into user_roles table.
   */
  public async assignSystemRoleToUser(params: {
    userId: string;
    tenantId: string;
    roleName: string;
    clinicId?: string | null;
  }): Promise<void> {
    const { userId, tenantId, clinicId } = params;
    let roleName = params.roleName || ROLE_CLINIC_OWNER;

    // Ensure roles exist in DB
    const roleIdMap = await this.ensureSystemRolesAndPermissions(tenantId);

    // Normalize role name if needed
    let roleId = roleIdMap[roleName];
    if (!roleId) {
      // Fallback to clinic_owner or admin
      roleId = roleIdMap[ROLE_CLINIC_OWNER] || roleIdMap[ROLE_ADMIN];
    }

    if (!roleId) return;

    // Check existing assignment
    const existing = await this.userRoleRepository.findActiveByUserAndRole(userId, roleId, tenantId);
    if (!existing) {
      await this.userRoleRepository.create({
        userId,
        roleId,
        tenantId,
        clinicId: clinicId ?? null,
      });
    }

    // Invalidate permission cache
    this.cache.invalidateByUserId(userId);
  }
}

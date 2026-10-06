/**
 * RBAC Bootstrap Service
 *
 * Provides utilities for seeding system permissions & roles into the database
 * and automatically assigning system roles into the user_roles table upon registration.
 */

import type { PrismaClient, Prisma } from '@prisma/client';
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
   * Can be called per-tenant, during initial platform startup, or within a transaction.
   */
  public async ensureSystemRolesAndPermissions(
    tenantId: string | null = null,
    db: Prisma.TransactionClient | PrismaClient = this.prisma,
  ): Promise<Record<string, string>> {
    // Step 1 — Bulk seed permissions
    const existingPerms = await db.permission.findMany();
    const existingPermNames = new Set(existingPerms.map((p) => p.name));
    const missingPerms = ALL_PERMISSIONS.filter((p) => !existingPermNames.has(p));

    if (missingPerms.length > 0) {
      await db.permission.createMany({
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

    const allPerms = await db.permission.findMany();
    const permissionIdMap: Record<string, string> = {};
    for (const p of allPerms) {
      permissionIdMap[p.name] = p.id;
    }

    // Step 2 — Bulk seed system roles
    const existingRoles = await db.role.findMany({
      where: { tenantId: tenantId ?? null, deletedAt: null },
    });
    const existingRoleNames = new Set(existingRoles.map((r) => r.name));
    const missingRoles = SYSTEM_ROLES.filter((r) => !existingRoleNames.has(r));

    if (missingRoles.length > 0) {
      await db.role.createMany({
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

    const allRoles = await db.role.findMany({
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
      await db.rolePermission.createMany({
        data: rolePermissionData,
        skipDuplicates: true,
      });
    }

    return roleIdMap;
  }

  /**
   * Automatically assigns a system role (e.g. clinic_owner, admin, receptionist, doctor) into user_roles table.
   * Fully transaction-aware: uses the passed `tx` if available, or falls back to root `this.prisma`.
   * Employs fast-path role lookup to eliminate redundant 5-query RBAC bootstrap on every call.
   */
  public async assignSystemRoleToUser(params: {
    userId: string;
    tenantId: string;
    roleName: string;
    clinicId?: string | null;
    tx?: Prisma.TransactionClient;
  }): Promise<void> {
    const { userId, tenantId, clinicId, tx } = params;
    const db = tx ?? this.prisma;
    let roleName = params.roleName || ROLE_CLINIC_OWNER;

    // Fast path: find existing active role directly without heavy bootstrap
    let role = await db.role.findFirst({
      where: {
        name: roleName,
        OR: [{ tenantId }, { tenantId: null }],
        deletedAt: null,
        isActive: true,
      },
      orderBy: { tenantId: 'desc' }, // Prefer tenant-specific role if both exist
    });

    // Slow fallback: Only if role is missing in database (unseeded tenant)
    if (!role) {
      const roleIdMap = await this.ensureSystemRolesAndPermissions(tenantId, db);
      const roleId = roleIdMap[roleName] || roleIdMap[ROLE_CLINIC_OWNER] || roleIdMap[ROLE_ADMIN];
      if (roleId) {
        role = await db.role.findUnique({ where: { id: roleId } });
      }
    }

    if (!role) return;

    // Deactivate any conflicting active roles for this user in this tenant
    await db.userRole.updateMany({
      where: {
        userId,
        tenantId,
        roleId: { not: role.id },
        isActive: true,
      },
      data: {
        isActive: false,
        revokedAt: new Date(),
      },
    });

    // Atomic Role Assignment / Reactivation
    await db.userRole.upsert({
      where: {
        userId_roleId_tenantId: {
          userId,
          roleId: role.id,
          tenantId,
        },
      },
      create: {
        userId,
        roleId: role.id,
        tenantId,
        clinicId: clinicId ?? null,
        isActive: true,
      },
      update: {
        isActive: true,
        revokedAt: null,
        expiresAt: null,
        clinicId: clinicId !== undefined ? (clinicId ?? null) : undefined,
      },
    });

    // Invalidate permission cache
    this.cache.invalidateByUserId(userId);
  }
}

/**
 * Permission Repository
 *
 * Persistence-only. No business rules. No authorization logic.
 */

import type { PrismaClient, Permission, Prisma } from '@prisma/client';

// --------------------------------------------------------------------------
// Types
// --------------------------------------------------------------------------

export interface CreatePermissionData {
  name: string;
  displayName: string;
  description?: string;
  resource: string;
  action: string;
}

export interface UpdatePermissionData {
  displayName?: string;
  description?: string;
  isActive?: boolean;
}

// --------------------------------------------------------------------------
// Repository
// --------------------------------------------------------------------------

export class PermissionRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(data: CreatePermissionData): Promise<Permission> {
    return this.prisma.permission.create({
      data: {
        name: data.name,
        displayName: data.displayName,
        description: data.description,
        resource: data.resource,
        action: data.action,
        isActive: true,
      },
    });
  }

  async findById(id: string): Promise<Permission | null> {
    return this.prisma.permission.findFirst({
      where: { id },
    });
  }

  async findByName(name: string): Promise<Permission | null> {
    return this.prisma.permission.findFirst({
      where: { name },
    });
  }

  async findMany(params: {
    resource?: string;
    activeOnly?: boolean;
  } = {}): Promise<Permission[]> {
    const where: Prisma.PermissionWhereInput = {};

    if (params.resource) {
      where.resource = params.resource;
    }

    if (params.activeOnly) {
      where.isActive = true;
    }

    return this.prisma.permission.findMany({
      where,
      orderBy: [{ resource: 'asc' }, { action: 'asc' }],
    });
  }

  async findByNames(names: readonly string[]): Promise<Permission[]> {
    return this.prisma.permission.findMany({
      where: {
        name: { in: [...names] },
        isActive: true,
      },
    });
  }

  async update(id: string, data: UpdatePermissionData): Promise<Permission> {
    return this.prisma.permission.update({
      where: { id },
      data: {
        ...data,
        updatedAt: new Date(),
      },
    });
  }

  async delete(id: string): Promise<Permission> {
    return this.prisma.permission.delete({ where: { id } });
  }

  // Role ↔ Permission join table operations

  async grantToRole(roleId: string, permissionId: string, grantedBy: string | null): Promise<void> {
    await this.prisma.rolePermission.create({
      data: {
        roleId,
        permissionId,
        grantedBy,
      },
    });
  }

  async revokeFromRole(roleId: string, permissionId: string): Promise<void> {
    await this.prisma.rolePermission.deleteMany({
      where: { roleId, permissionId },
    });
  }

  async isGrantedToRole(roleId: string, permissionId: string): Promise<boolean> {
    const count = await this.prisma.rolePermission.count({
      where: { roleId, permissionId },
    });
    return count > 0;
  }

  async findPermissionsForRole(roleId: string): Promise<Permission[]> {
    const rows = await this.prisma.rolePermission.findMany({
      where: { roleId },
      include: {
        permission: true,
      },
    });
    return rows.map((r) => r.permission);
  }

  async findPermissionNamesForRoles(roleIds: string[]): Promise<Set<string>> {
    if (roleIds.length === 0) return new Set();

    const rows = await this.prisma.rolePermission.findMany({
      where: {
        roleId: { in: roleIds },
        permission: { isActive: true },
      },
      include: {
        permission: { select: { name: true } },
      },
    });

    return new Set(rows.map((r) => r.permission.name));
  }
}

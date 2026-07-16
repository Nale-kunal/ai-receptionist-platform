/**
 * Role Repository
 *
 * Persistence-only. No business rules. No authorization logic.
 * Speaks directly to Prisma.
 */

import type { PrismaClient, Role, Prisma } from '@prisma/client';

// --------------------------------------------------------------------------
// Types
// --------------------------------------------------------------------------

export interface CreateRoleData {
  tenantId: string | null;
  name: string;
  displayName: string;
  description?: string;
  isSystem?: boolean;
}

export interface UpdateRoleData {
  displayName?: string;
  description?: string;
  isActive?: boolean;
}

export interface RoleWithPermissions extends Role {
  rolePermissions: Array<{
    permission: {
      id: string;
      name: string;
      resource: string;
      action: string;
      isActive: boolean;
    };
  }>;
}

// --------------------------------------------------------------------------
// Repository
// --------------------------------------------------------------------------

export class RoleRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(data: CreateRoleData): Promise<Role> {
    return this.prisma.role.create({
      data: {
        tenantId: data.tenantId,
        name: data.name,
        displayName: data.displayName,
        description: data.description,
        isSystem: data.isSystem ?? false,
        isActive: true,
      },
    });
  }

  async findById(id: string): Promise<Role | null> {
    return this.prisma.role.findFirst({
      where: { id, deletedAt: null },
    });
  }

  async findByIdWithPermissions(id: string): Promise<RoleWithPermissions | null> {
    return this.prisma.role.findFirst({
      where: { id, deletedAt: null },
      include: {
        rolePermissions: {
          include: {
            permission: {
              select: { id: true, name: true, resource: true, action: true, isActive: true },
            },
          },
        },
      },
    });
  }

  async findByName(name: string, tenantId: string | null): Promise<Role | null> {
    return this.prisma.role.findFirst({
      where: {
        name,
        tenantId: tenantId ?? null,
        deletedAt: null,
      },
    });
  }

  async findMany(params: {
    tenantId?: string | null;
    includeSystem?: boolean;
    activeOnly?: boolean;
  }): Promise<Role[]> {
    const where: Prisma.RoleWhereInput = {
      deletedAt: null,
    };

    if (params.tenantId !== undefined) {
      if (params.includeSystem) {
        // Include both tenant-specific roles and system roles (tenantId = null)
        where.OR = [{ tenantId: params.tenantId }, { isSystem: true, tenantId: null }];
      } else {
        where.tenantId = params.tenantId;
      }
    }

    if (params.activeOnly) {
      where.isActive = true;
    }

    return this.prisma.role.findMany({
      where,
      orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
    });
  }

  async update(id: string, data: UpdateRoleData): Promise<Role> {
    return this.prisma.role.update({
      where: { id },
      data: {
        ...data,
        updatedAt: new Date(),
      },
    });
  }

  async softDelete(id: string): Promise<Role> {
    return this.prisma.role.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        isActive: false,
        updatedAt: new Date(),
      },
    });
  }

  async countPermissions(roleId: string): Promise<number> {
    return this.prisma.rolePermission.count({
      where: { roleId },
    });
  }
}

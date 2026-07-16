/**
 * User Role Repository
 *
 * Persistence-only. Manages user ↔ role assignments.
 */

import type { PrismaClient, UserRole } from '@prisma/client';

// --------------------------------------------------------------------------
// Types
// --------------------------------------------------------------------------

export interface CreateUserRoleData {
  userId: string;
  roleId: string;
  tenantId: string;
  clinicId?: string | null;
  assignedBy?: string | null;
  expiresAt?: Date;
}

export interface UserRoleWithRole extends UserRole {
  role: {
    id: string;
    name: string;
    displayName: string;
    isActive: boolean;
    isSystem: boolean;
  };
}

// --------------------------------------------------------------------------
// Repository
// --------------------------------------------------------------------------

export class UserRoleRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(data: CreateUserRoleData): Promise<UserRole> {
    return this.prisma.userRole.create({
      data: {
        userId: data.userId,
        roleId: data.roleId,
        tenantId: data.tenantId,
        clinicId: data.clinicId ?? null,
        assignedBy: data.assignedBy ?? null,
        expiresAt: data.expiresAt,
        isActive: true,
      },
    });
  }

  async findById(id: string): Promise<UserRole | null> {
    return this.prisma.userRole.findFirst({ where: { id } });
  }

  async findActiveByUserAndRole(
    userId: string,
    roleId: string,
    tenantId: string,
  ): Promise<UserRole | null> {
    return this.prisma.userRole.findFirst({
      where: {
        userId,
        roleId,
        tenantId,
        isActive: true,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
    });
  }

  async findActiveByUser(userId: string, tenantId: string): Promise<UserRoleWithRole[]> {
    return this.prisma.userRole.findMany({
      where: {
        userId,
        tenantId,
        isActive: true,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      include: {
        role: {
          select: {
            id: true,
            name: true,
            displayName: true,
            isActive: true,
            isSystem: true,
          },
        },
      },
      orderBy: { assignedAt: 'desc' },
    }) as Promise<UserRoleWithRole[]>;
  }

  /**
   * Returns all active role IDs for a user across all clinics in the tenant.
   * Used by the permission evaluator to resolve permission sets.
   */
  async findActiveRoleIds(userId: string, tenantId: string): Promise<string[]> {
    const rows = await this.prisma.userRole.findMany({
      where: {
        userId,
        tenantId,
        isActive: true,
        role: { isActive: true, deletedAt: null },
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      select: { roleId: true },
    });
    return rows.map((r) => r.roleId);
  }

  async revoke(id: string): Promise<UserRole> {
    return this.prisma.userRole.update({
      where: { id },
      data: {
        isActive: false,
        revokedAt: new Date(),
      },
    });
  }

  async revokeByUserAndRole(userId: string, roleId: string, tenantId: string): Promise<number> {
    const result = await this.prisma.userRole.updateMany({
      where: { userId, roleId, tenantId, isActive: true },
      data: { isActive: false, revokedAt: new Date() },
    });
    return result.count;
  }

  async revokeAllByUser(userId: string, tenantId: string): Promise<number> {
    const result = await this.prisma.userRole.updateMany({
      where: { userId, tenantId, isActive: true },
      data: { isActive: false, revokedAt: new Date() },
    });
    return result.count;
  }
}

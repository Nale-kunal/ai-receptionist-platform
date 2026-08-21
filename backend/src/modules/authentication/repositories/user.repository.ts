/**
 * User Repository
 *
 * Persistence-only. No business rules. No external API calls.
 * Speaks directly to Prisma.
 *
 * Per Implementation Principles §7 (Repository Contract):
 * - Repositories MUST NOT contain business rules.
 * - Repositories MUST NOT call other repositories.
 * - Repositories MUST NOT call external APIs.
 */

import type { PrismaClient, User, Prisma } from '@prisma/client';
import { withDbRetry } from '../../../shared/database/dbRetry';

// --------------------------------------------------------------------------
// Types
// --------------------------------------------------------------------------

export interface CreateUserData {
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  tenantId: string;
  role?: string;
  clinicId?: string | null;
}

export interface UpdateUserData {
  passwordHash?: string;
  firstName?: string;
  lastName?: string;
  role?: string;
  status?: string;
  emailVerified?: boolean;
  emailVerifiedAt?: Date;
  tokenVersion?: number;
  failedLoginAttempts?: number;
  lockedUntil?: Date | null;
  lastLoginAt?: Date;
  passwordChangedAt?: Date;
  updatedBy?: string;
  clinicId?: string | null;
  deletedAt?: Date | null;
}

export interface UserWithoutSensitiveFields
  extends Omit<User, 'passwordHash' | 'tokenVersion'> {}

// --------------------------------------------------------------------------
// Repository
// --------------------------------------------------------------------------

export class UserRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(data: CreateUserData): Promise<User> {
    return withDbRetry(() =>
      this.prisma.user.create({
        data: {
          email: data.email,
          passwordHash: data.passwordHash,
          firstName: data.firstName,
          lastName: data.lastName,
          tenantId: data.tenantId,
          role: data.role ?? 'clinic_owner',
          status: 'active',
          emailVerified: false,
          tokenVersion: 0,
          failedLoginAttempts: 0,
          clinicId: data.clinicId ?? null,
        },
      }),
    );
  }

  async findById(id: string): Promise<User | null> {
    return withDbRetry(() =>
      this.prisma.user.findFirst({
        where: {
          id,
          deletedAt: null,
        },
      }),
    );
  }

  async findByPublicId(publicId: string): Promise<User | null> {
    return withDbRetry(() =>
      this.prisma.user.findFirst({
        where: {
          publicId,
          deletedAt: null,
        },
      }),
    );
  }

  async findByEmail(email: string): Promise<User | null> {
    return withDbRetry(() =>
      this.prisma.user.findFirst({
        where: {
          email: email.toLowerCase().trim(),
          deletedAt: null,
        },
      }),
    );
  }

  async findByEmailAndTenant(email: string, tenantId: string): Promise<User | null> {
    return withDbRetry(() =>
      this.prisma.user.findFirst({
        where: {
          email: email.toLowerCase().trim(),
          tenantId,
          deletedAt: null,
        },
      }),
    );
  }

  async exists(email: string): Promise<boolean> {
    const count = await withDbRetry(() =>
      this.prisma.user.count({
        where: {
          email: email.toLowerCase().trim(),
          deletedAt: null,
        },
      }),
    );
    return count > 0;
  }

  async update(id: string, data: UpdateUserData): Promise<User> {
    return this.prisma.user.update({
      where: { id },
      data: {
        ...data,
        updatedAt: new Date(),
      },
    });
  }

  async incrementFailedLoginAttempts(id: string): Promise<User> {
    return this.prisma.user.update({
      where: { id },
      data: {
        failedLoginAttempts: { increment: 1 },
        updatedAt: new Date(),
      },
    });
  }

  async resetFailedLoginAttempts(id: string): Promise<User> {
    return this.prisma.user.update({
      where: { id },
      data: {
        failedLoginAttempts: 0,
        lockedUntil: null,
        updatedAt: new Date(),
      },
    });
  }

  async incrementTokenVersion(id: string): Promise<User> {
    return this.prisma.user.update({
      where: { id },
      data: {
        tokenVersion: { increment: 1 },
        updatedAt: new Date(),
      },
    });
  }

  async count(where?: Prisma.UserWhereInput): Promise<number> {
    return this.prisma.user.count({ where: { ...where, deletedAt: null } });
  }

  async findByIdWithRelations(id: string): Promise<any | null> {
    const user = await this.prisma.user.findFirst({
      where: {
        id,
        deletedAt: null,
      },
      include: {
        tenant: true,
        clinic: true,
      },
    });

    if (user && !user.clinic && user.tenantId) {
      const primaryClinic = await this.prisma.clinic.findFirst({
        where: { tenantId: user.tenantId },
        orderBy: { createdAt: 'asc' },
      });
      if (primaryClinic) {
        (user as any).clinic = primaryClinic;
      }
    }

    return user;
  }

  async findMany(params: {
    tenantId: string;
    limit?: number;
    offset?: number;
    search?: string;
    role?: string;
    status?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    includeDeleted?: boolean;
  }): Promise<User[]> {
    const { tenantId, limit, offset, search, role, status, sortBy = 'createdAt', sortOrder = 'desc', includeDeleted = false } = params;

    const where: Prisma.UserWhereInput = {
      tenantId,
      ...(includeDeleted ? {} : { deletedAt: null }),
      ...(role ? { role } : {}),
      ...(status ? { status } : {}),
      ...(search ? {
        OR: [
          { email: { contains: search, mode: 'insensitive' } },
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
        ],
      } : {}),
    };

    return this.prisma.user.findMany({
      where,
      take: limit,
      skip: offset,
      orderBy: { [sortBy]: sortOrder },
    });
  }

  async softDelete(id: string): Promise<User> {
    return this.prisma.user.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        updatedAt: new Date(),
      },
    });
  }

  async restore(id: string): Promise<User> {
    return this.prisma.user.update({
      where: { id },
      data: {
        deletedAt: null,
        updatedAt: new Date(),
      },
    });
  }

  async hardDelete(id: string): Promise<User> {
    return this.prisma.user.delete({
      where: { id },
    });
  }
}

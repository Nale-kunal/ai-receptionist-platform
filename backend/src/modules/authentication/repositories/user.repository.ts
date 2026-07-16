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
}

export interface UserWithoutSensitiveFields
  extends Omit<User, 'passwordHash' | 'tokenVersion'> {}

// --------------------------------------------------------------------------
// Repository
// --------------------------------------------------------------------------

export class UserRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(data: CreateUserData): Promise<User> {
    return this.prisma.user.create({
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
      },
    });
  }

  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findFirst({
      where: {
        id,
        deletedAt: null,
      },
    });
  }

  async findByPublicId(publicId: string): Promise<User | null> {
    return this.prisma.user.findFirst({
      where: {
        publicId,
        deletedAt: null,
      },
    });
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findFirst({
      where: {
        email: email.toLowerCase().trim(),
        deletedAt: null,
      },
    });
  }

  async findByEmailAndTenant(email: string, tenantId: string): Promise<User | null> {
    return this.prisma.user.findFirst({
      where: {
        email: email.toLowerCase().trim(),
        tenantId,
        deletedAt: null,
      },
    });
  }

  async exists(email: string): Promise<boolean> {
    const count = await this.prisma.user.count({
      where: {
        email: email.toLowerCase().trim(),
        deletedAt: null,
      },
    });
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
}

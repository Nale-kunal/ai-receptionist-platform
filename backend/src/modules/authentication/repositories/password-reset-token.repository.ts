/**
 * Password Reset Token Repository
 *
 * Persistence-only.
 * Stores hashed one-time password reset tokens.
 * Raw tokens are never persisted.
 */

import type { PrismaClient, PasswordResetToken } from '@prisma/client';

// --------------------------------------------------------------------------
// Types
// --------------------------------------------------------------------------

export interface CreatePasswordResetTokenData {
  userId: string;
  tenantId: string;
  tokenHash: string;
  expiresAt: Date;
}

// --------------------------------------------------------------------------
// Repository
// --------------------------------------------------------------------------

export class PasswordResetTokenRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(data: CreatePasswordResetTokenData): Promise<PasswordResetToken> {
    return this.prisma.passwordResetToken.create({
      data: {
        userId: data.userId,
        tenantId: data.tenantId,
        tokenHash: data.tokenHash,
        expiresAt: data.expiresAt,
        used: false,
      },
    });
  }

  async findByTokenHash(tokenHash: string): Promise<PasswordResetToken | null> {
    return this.prisma.passwordResetToken.findFirst({
      where: {
        tokenHash,
        used: false,
        expiresAt: { gt: new Date() },
      },
    });
  }

  async markUsed(id: string): Promise<PasswordResetToken> {
    return this.prisma.passwordResetToken.update({
      where: { id },
      data: {
        used: true,
        usedAt: new Date(),
      },
    });
  }

  async invalidateAllForUser(userId: string): Promise<number> {
    const result = await this.prisma.passwordResetToken.updateMany({
      where: {
        userId,
        used: false,
      },
      data: {
        used: true,
        usedAt: new Date(),
      },
    });
    return result.count;
  }

  async deleteExpired(): Promise<number> {
    const result = await this.prisma.passwordResetToken.deleteMany({
      where: {
        expiresAt: { lt: new Date() },
      },
    });
    return result.count;
  }
}

/**
 * Email Verification Token Repository
 *
 * Persistence-only.
 * Stores hashed one-time email verification tokens.
 * Raw tokens are never persisted.
 */

import type { PrismaClient, EmailVerificationToken } from '@prisma/client';

// --------------------------------------------------------------------------
// Types
// --------------------------------------------------------------------------

export interface CreateEmailVerificationTokenData {
  userId: string;
  tenantId: string;
  tokenHash: string;
  expiresAt: Date;
}

// --------------------------------------------------------------------------
// Repository
// --------------------------------------------------------------------------

export class EmailVerificationTokenRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(data: CreateEmailVerificationTokenData): Promise<EmailVerificationToken> {
    return this.prisma.emailVerificationToken.create({
      data: {
        userId: data.userId,
        tenantId: data.tenantId,
        tokenHash: data.tokenHash,
        expiresAt: data.expiresAt,
        used: false,
      },
    });
  }

  async findByTokenHash(tokenHash: string): Promise<EmailVerificationToken | null> {
    return this.prisma.emailVerificationToken.findFirst({
      where: {
        tokenHash,
        used: false,
        expiresAt: { gt: new Date() },
      },
    });
  }

  async markUsed(id: string): Promise<EmailVerificationToken> {
    return this.prisma.emailVerificationToken.update({
      where: { id },
      data: {
        used: true,
        usedAt: new Date(),
      },
    });
  }

  async invalidateAllForUser(userId: string): Promise<number> {
    const result = await this.prisma.emailVerificationToken.updateMany({
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
    const result = await this.prisma.emailVerificationToken.deleteMany({
      where: {
        expiresAt: { lt: new Date() },
      },
    });
    return result.count;
  }
}

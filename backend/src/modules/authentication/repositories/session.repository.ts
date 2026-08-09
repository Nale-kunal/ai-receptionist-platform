/**
 * Session Repository
 *
 * Persistence-only. Manages auth session records.
 * Sessions track one login per session ID.
 * Refresh token hashes are stored here (never the raw token).
 */

import type { PrismaClient, Session } from '@prisma/client';

// --------------------------------------------------------------------------
// Types
// --------------------------------------------------------------------------

export interface CreateSessionData {
  userId: string;
  tenantId: string;
  refreshTokenHash: string;
  userAgent: string;
  ipAddress: string;
  browser: string | null;
  operatingSystem: string | null;
  deviceType: string;
  expiresAt: Date;
}

export interface UpdateSessionData {
  refreshTokenHash?: string;
  previousRefreshTokenHash?: string;
  rotatedAt?: Date;
  lastActivityAt?: Date;
  expiresAt?: Date;
  status?: string;
}

// --------------------------------------------------------------------------
// Repository
// --------------------------------------------------------------------------

export class SessionRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(data: CreateSessionData): Promise<Session> {
    return this.prisma.session.create({
      data: {
        userId: data.userId,
        tenantId: data.tenantId,
        refreshTokenHash: data.refreshTokenHash,
        userAgent: data.userAgent,
        ipAddress: data.ipAddress,
        browser: data.browser,
        operatingSystem: data.operatingSystem,
        deviceType: data.deviceType,
        expiresAt: data.expiresAt,
        status: 'active',
        lastActivityAt: new Date(),
      },
    });
  }

  async findById(id: string): Promise<Session | null> {
    return this.prisma.session.findFirst({
      where: { id },
    });
  }

  async findByRefreshTokenHash(refreshTokenHash: string): Promise<Session | null> {
    return this.prisma.session.findFirst({
      where: {
        OR: [
          { refreshTokenHash },
          { previousRefreshTokenHash: refreshTokenHash },
        ],
        status: 'active',
        expiresAt: { gt: new Date() },
      },
    });
  }

  async findActiveById(id: string): Promise<Session | null> {
    return this.prisma.session.findFirst({
      where: {
        id,
        status: 'active',
        expiresAt: { gt: new Date() },
      },
    });
  }

  async findActiveByUserId(userId: string): Promise<Session[]> {
    return this.prisma.session.findMany({
      where: {
        userId,
        status: 'active',
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async update(id: string, data: UpdateSessionData): Promise<Session> {
    return this.prisma.session.update({
      where: { id },
      data: {
        ...data,
        updatedAt: new Date(),
      },
    });
  }

  async revokeById(id: string): Promise<Session> {
    return this.prisma.session.update({
      where: { id },
      data: {
        status: 'revoked',
        updatedAt: new Date(),
      },
    });
  }

  async revokeAllByUserId(userId: string): Promise<number> {
    const result = await this.prisma.session.updateMany({
      where: {
        userId,
        status: 'active',
      },
      data: {
        status: 'revoked',
        updatedAt: new Date(),
      },
    });
    return result.count;
  }

  async updateLastActivity(id: string): Promise<void> {
    await this.prisma.session.update({
      where: { id },
      data: {
        lastActivityAt: new Date(),
        updatedAt: new Date(),
      },
    });
  }

  async deleteExpired(): Promise<number> {
    const result = await this.prisma.session.deleteMany({
      where: {
        expiresAt: { lt: new Date() },
        status: { in: ['expired', 'revoked'] },
      },
    });
    return result.count;
  }

  async count(userId: string): Promise<number> {
    return this.prisma.session.count({
      where: {
        userId,
        status: 'active',
        expiresAt: { gt: new Date() },
      },
    });
  }
}

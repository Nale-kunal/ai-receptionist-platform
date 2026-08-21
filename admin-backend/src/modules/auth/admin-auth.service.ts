/**
 * Admin Auth Service
 *
 * Business logic for Super Admin authentication:
 *   - Login (with brute-force protection + account locking)
 *   - Logout (session revocation)
 *   - Refresh token rotation
 *   - Password change (enforced on first login via mustChangePassword)
 *
 * SECURITY:
 *   - Passwords verified with argon2id (constant-time)
 *   - Refresh token reuse detection → revoke entire session
 *   - Account lockout: 5 failures → 15 minutes
 *   - All mutations emit AdminAuditLog entries
 *   - Never logs passwords, tokens, or secrets
 */

import * as argon2 from 'argon2';
import type { PrismaClient } from '@prisma/client';
import type { AdminTokenService } from './admin-token.service';
import { adminCache } from '../../shared/admin-cache';

const ARGON2_OPTIONS: argon2.Options & { raw?: false } = {
  type: argon2.argon2id,
  memoryCost: 65536,
  timeCost: 3,
  parallelism: 1,
};

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes
const SESSION_TTL_DAYS = 7;

export interface LoginParams {
  email: string;
  password: string;
  ipAddress: string;
  userAgent: string;
}

export interface LoginResult {
  accessToken: string;
  refreshToken: string;
  admin: { id: string; email: string; displayName: string; mustChangePassword: boolean };
}

export class AdminAuthService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly tokenService: AdminTokenService,
  ) {}

  async login(params: LoginParams): Promise<LoginResult> {
    const { email, password, ipAddress, userAgent } = params;

    // Find admin (case-insensitive)
    const admin = await this.prisma.superAdmin.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    // Constant-time "not found" path — prevents user enumeration
    if (!admin) {
      await argon2.hash('__dummy_to_prevent_timing_attack__', ARGON2_OPTIONS);
      throw Object.assign(new Error('Invalid email or password'), { status: 401, code: 'INVALID_CREDENTIALS' });
    }

    // Account inactive
    if (!admin.isActive) {
      throw Object.assign(new Error('Account is disabled. Contact platform support.'), { status: 403, code: 'ACCOUNT_DISABLED' });
    }

    // Account locked
    if (admin.lockedUntil && admin.lockedUntil > new Date()) {
      const minutesLeft = Math.ceil((admin.lockedUntil.getTime() - Date.now()) / 60000);
      throw Object.assign(
        new Error(`Account temporarily locked. Try again in ${minutesLeft} minute(s).`),
        { status: 429, code: 'ACCOUNT_LOCKED' }
      );
    }

    // Verify password
    const valid = await argon2.verify(admin.passwordHash, password);

    if (!valid) {
      const newFailedCount = admin.failedLoginAttempts + 1;
      const shouldLock = newFailedCount >= MAX_FAILED_ATTEMPTS;

      await this.prisma.superAdmin.update({
        where: { id: admin.id },
        data: {
          failedLoginAttempts: newFailedCount,
          lockedUntil: shouldLock ? new Date(Date.now() + LOCKOUT_DURATION_MS) : null,
        },
      });

      await this._audit(admin.id, 'admin.login.failed', 'SuperAdmin', admin.id, 'failure', { email, ipAddress });

      if (shouldLock) {
        throw Object.assign(new Error('Too many failed attempts. Account locked for 15 minutes.'), { status: 429, code: 'ACCOUNT_LOCKED' });
      }
      throw Object.assign(new Error('Invalid email or password'), { status: 401, code: 'INVALID_CREDENTIALS' });
    }

    // Success — reset failure count, update lastLoginAt
    const updatedAdmin = await this.prisma.superAdmin.update({
      where: { id: admin.id },
      data: {
        failedLoginAttempts: 0,
        lockedUntil: null,
        lastLoginAt: new Date(),
      },
    });

    // Create session
    const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);
    const session = await this.prisma.adminSession.create({
      data: {
        adminId: admin.id,
        refreshTokenHash: 'pending', // will update below
        userAgent: userAgent.slice(0, 500),
        ipAddress,
        status: 'active',
        expiresAt,
      },
    });

    // Issue tokens
    const accessToken = this.tokenService.issueAccessToken({
      adminId: admin.id,
      sessionId: session.id,
      tokenVersion: updatedAdmin.tokenVersion,
    });
    const refreshToken = this.tokenService.issueRefreshToken({
      adminId: admin.id,
      sessionId: session.id,
      tokenVersion: updatedAdmin.tokenVersion,
    });

    // Store hashed refresh token
    await this.prisma.adminSession.update({
      where: { id: session.id },
      data: { refreshTokenHash: this.tokenService.hashToken(refreshToken) },
    });

    await this._audit(admin.id, 'admin.login.success', 'SuperAdmin', admin.id, 'success', { ipAddress });

    return {
      accessToken,
      refreshToken,
      admin: {
        id: admin.id,
        email: admin.email,
        displayName: admin.displayName,
        mustChangePassword: admin.mustChangePassword,
      },
    };
  }

  async refreshTokens(rawRefreshToken: string, ipAddress: string): Promise<{ accessToken: string; refreshToken: string }> {
    let payload;
    try {
      payload = this.tokenService.verifyRefreshToken(rawRefreshToken);
    } catch {
      throw Object.assign(new Error('Invalid or expired refresh token'), { status: 401, code: 'INVALID_REFRESH_TOKEN' });
    }

    const session = await this.prisma.adminSession.findUnique({ where: { id: payload.sessionId } });
    if (!session || session.status !== 'active' || session.expiresAt < new Date()) {
      throw Object.assign(new Error('Session expired or revoked'), { status: 401, code: 'SESSION_INACTIVE' });
    }

    const incomingHash = this.tokenService.hashToken(rawRefreshToken);
    const isCurrentToken = session.refreshTokenHash === incomingHash;
    const isPreviousToken = session.previousRefreshTokenHash === incomingHash;

    if (!isCurrentToken && !isPreviousToken) {
      // Token reuse detected — revoke session
      await this.prisma.adminSession.update({ where: { id: session.id }, data: { status: 'revoked' } });
      await this._audit(payload.adminId, 'admin.token.reuse', 'AdminSession', session.id, 'failure', { ipAddress });
      throw Object.assign(new Error('Refresh token reuse detected. Session revoked.'), { status: 401, code: 'TOKEN_REUSE' });
    }

    const admin = await this.prisma.superAdmin.findUnique({ where: { id: payload.adminId } });
    if (!admin || !admin.isActive) {
      throw Object.assign(new Error('Account is disabled'), { status: 403, code: 'ACCOUNT_DISABLED' });
    }

    // Issue new tokens
    const newAccessToken = this.tokenService.issueAccessToken({ adminId: admin.id, sessionId: session.id, tokenVersion: admin.tokenVersion });
    const newRefreshToken = this.tokenService.issueRefreshToken({ adminId: admin.id, sessionId: session.id, tokenVersion: admin.tokenVersion });

    // Rotate: store new hash, keep previous for grace period
    await this.prisma.adminSession.update({
      where: { id: session.id },
      data: {
        previousRefreshTokenHash: session.refreshTokenHash,
        refreshTokenHash: this.tokenService.hashToken(newRefreshToken),
        rotatedAt: new Date(),
        lastActivityAt: new Date(),
      },
    });

    return { accessToken: newAccessToken, refreshToken: newRefreshToken };
  }

  async logout(sessionId: string, adminId: string): Promise<void> {
    adminCache.invalidate(`session:${sessionId}`);
    await this.prisma.adminSession.updateMany({
      where: { id: sessionId, adminId },
      data: { status: 'revoked' },
    });
    await this._audit(adminId, 'admin.logout', 'AdminSession', sessionId, 'success', {});
  }

  async changePassword(adminId: string, currentPassword: string, newPassword: string): Promise<void> {
    const admin = await this.prisma.superAdmin.findUnique({ where: { id: adminId } });
    if (!admin) throw Object.assign(new Error('Admin not found'), { status: 404, code: 'NOT_FOUND' });

    const valid = await argon2.verify(admin.passwordHash, currentPassword);
    if (!valid) {
      throw Object.assign(new Error('Current password is incorrect'), { status: 401, code: 'INVALID_CREDENTIALS' });
    }

    if (newPassword.length < 12) {
      throw Object.assign(new Error('New password must be at least 12 characters'), { status: 422, code: 'VALIDATION_ERROR' });
    }

    const newHash = await argon2.hash(newPassword, ARGON2_OPTIONS);

    await this.prisma.superAdmin.update({
      where: { id: adminId },
      data: {
        passwordHash: newHash,
        mustChangePassword: false,
        passwordChangedAt: new Date(),
        tokenVersion: { increment: 1 }, // Revoke all existing sessions
      },
    });

    // Revoke all sessions to force re-login after password change
    adminCache.invalidate('session:');
    await this.prisma.adminSession.updateMany({
      where: { adminId, status: 'active' },
      data: { status: 'revoked' },
    });

    await this._audit(adminId, 'admin.password.changed', 'SuperAdmin', adminId, 'success', {});
  }

  private async _audit(
    adminId: string | null,
    action: string,
    entityType: string,
    entityId: string,
    outcome: 'success' | 'failure',
    metadata: Record<string, unknown>,
  ): Promise<void> {
    await this.prisma.adminAuditLog.create({
      data: { adminId, action, entityType, entityId, outcome, metadata: metadata as any },
    }).catch(() => {}); // Audit failures must not break auth flow
  }
}

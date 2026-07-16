/**
 * Session Service
 *
 * Owns session lifecycle business logic.
 * Delegates persistence to SessionRepository.
 *
 * Responsibilities:
 *   - Create sessions on login
 *   - Validate active sessions
 *   - Update session activity timestamps
 *   - Revoke individual sessions
 *   - Revoke all user sessions (password reset, security incident)
 *   - Map raw Prisma Session records to SessionContext value objects
 */

import type { SessionRepository } from '../repositories/session.repository';
import type { ISessionService, CreateSessionParams } from '../interfaces/auth.interfaces';
import type { SessionContext, DeviceInfo } from '../types/auth.types';
import { SessionNotFoundError, SessionInactiveError, SessionExpiredError } from '../errors/auth.errors';

// --------------------------------------------------------------------------
// Session Service
// --------------------------------------------------------------------------

export class SessionService implements ISessionService {
  constructor(private readonly sessionRepository: SessionRepository) {}

  async createSession(params: CreateSessionParams): Promise<SessionContext> {
    const session = await this.sessionRepository.create({
      userId: params.userId,
      tenantId: params.tenantId,
      refreshTokenHash: params.refreshTokenHash,
      userAgent: params.deviceInfo.userAgent,
      ipAddress: params.deviceInfo.ipAddress,
      browser: params.deviceInfo.browser,
      operatingSystem: params.deviceInfo.operatingSystem,
      deviceType: params.deviceInfo.deviceType,
      expiresAt: params.expiresAt,
    });

    return this.mapToSessionContext(session, params.deviceInfo);
  }

  async getSession(sessionId: string): Promise<SessionContext | null> {
    const session = await this.sessionRepository.findById(sessionId);
    if (!session) {
      return null;
    }

    const deviceInfo: DeviceInfo = {
      userAgent: session.userAgent,
      ipAddress: session.ipAddress,
      browser: session.browser,
      operatingSystem: session.operatingSystem,
      deviceType: this.parseDeviceType(session.deviceType),
    };

    return this.mapToSessionContext(session, deviceInfo);
  }

  async validateActiveSession(sessionId: string): Promise<SessionContext> {
    const session = await this.sessionRepository.findById(sessionId);

    if (!session) {
      throw new SessionNotFoundError();
    }

    if (session.status !== 'active') {
      throw new SessionInactiveError();
    }

    if (session.expiresAt < new Date()) {
      // Mark as expired in the background — do not await to keep validation fast
      void this.sessionRepository.update(sessionId, { status: 'expired' }).catch(() => void 0);
      throw new SessionExpiredError();
    }

    const deviceInfo: DeviceInfo = {
      userAgent: session.userAgent,
      ipAddress: session.ipAddress,
      browser: session.browser,
      operatingSystem: session.operatingSystem,
      deviceType: this.parseDeviceType(session.deviceType),
    };

    return this.mapToSessionContext(session, deviceInfo);
  }

  async updateSessionActivity(sessionId: string): Promise<void> {
    await this.sessionRepository.updateLastActivity(sessionId);
  }

  async revokeSession(sessionId: string): Promise<void> {
    await this.sessionRepository.revokeById(sessionId);
  }

  async revokeAllUserSessions(userId: string): Promise<void> {
    await this.sessionRepository.revokeAllByUserId(userId);
  }

  async getUserActiveSessions(userId: string): Promise<SessionContext[]> {
    const sessions = await this.sessionRepository.findActiveByUserId(userId);

    return sessions.map((session) => {
      const deviceInfo: DeviceInfo = {
        userAgent: session.userAgent,
        ipAddress: session.ipAddress,
        browser: session.browser,
        operatingSystem: session.operatingSystem,
        deviceType: this.parseDeviceType(session.deviceType),
      };
      return this.mapToSessionContext(session, deviceInfo);
    });
  }

  // --------------------------------------------------------------------------
  // Private Helpers
  // --------------------------------------------------------------------------

  private mapToSessionContext(session: any, deviceInfo: DeviceInfo): SessionContext {
    return {
      sessionId: session.id,
      userId: session.userId,
      tenantId: session.tenantId,
      createdAt: session.createdAt,
      lastActivityAt: session.lastActivityAt,
      expiresAt: session.expiresAt,
      device: deviceInfo,
      isActive: session.status === 'active',
    };
  }

  private parseDeviceType(raw: string | null): DeviceInfo['deviceType'] {
    const validTypes: Array<DeviceInfo['deviceType']> = ['desktop', 'mobile', 'tablet', 'unknown'];
    return validTypes.includes(raw as DeviceInfo['deviceType'])
      ? (raw as DeviceInfo['deviceType'])
      : 'unknown';
  }
}

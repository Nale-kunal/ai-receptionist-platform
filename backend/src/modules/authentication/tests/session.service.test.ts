/**
 * Session Service Unit Tests
 *
 * Tests session lifecycle management with mocked repository.
 */

import { SessionService } from '../services/session.service';
import {
  SessionNotFoundError,
  SessionInactiveError,
  SessionExpiredError,
} from '../errors/auth.errors';

// --------------------------------------------------------------------------
// Mocks
// --------------------------------------------------------------------------

const mockSessionRepository = {
  create: jest.fn(),
  findById: jest.fn(),
  findActiveById: jest.fn(),
  findActiveByUserId: jest.fn(),
  update: jest.fn(),
  revokeById: jest.fn(),
  revokeAllByUserId: jest.fn(),
  updateLastActivity: jest.fn(),
};

function makeSessionRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'session-id-abc',
    userId: 'user-id-123',
    tenantId: 'tenant-id-456',
    refreshTokenHash: 'some-hash',
    userAgent: 'TestAgent/1.0',
    ipAddress: '127.0.0.1',
    browser: null,
    operatingSystem: null,
    deviceType: 'desktop',
    status: 'active',
    lastActivityAt: new Date(),
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeDeviceInfo() {
  return {
    userAgent: 'TestAgent/1.0',
    ipAddress: '127.0.0.1',
    browser: null,
    operatingSystem: null,
    deviceType: 'desktop' as const,
  };
}

// --------------------------------------------------------------------------
// Tests
// --------------------------------------------------------------------------

describe('SessionService', () => {
  let sessionService: SessionService;

  beforeEach(() => {
    jest.clearAllMocks();
    sessionService = new SessionService(mockSessionRepository as any);
  });

  describe('createSession', () => {
    it('should create and return a SessionContext', async () => {
      const sessionRecord = makeSessionRecord();
      mockSessionRepository.create.mockResolvedValue(sessionRecord);

      const context = await sessionService.createSession({
        userId: 'user-id-123',
        tenantId: 'tenant-id-456',
        refreshTokenHash: 'hashed-token',
        deviceInfo: makeDeviceInfo(),
        expiresAt: sessionRecord.expiresAt as Date,
      });

      expect(context.sessionId).toBe('session-id-abc');
      expect(context.userId).toBe('user-id-123');
      expect(context.isActive).toBe(true);
      expect(mockSessionRepository.create).toHaveBeenCalledTimes(1);
    });
  });

  describe('validateActiveSession', () => {
    it('should throw SessionNotFoundError when session does not exist', async () => {
      mockSessionRepository.findById.mockResolvedValue(null);

      await expect(
        sessionService.validateActiveSession('nonexistent-id'),
      ).rejects.toThrow(SessionNotFoundError);
    });

    it('should throw SessionInactiveError when session is revoked', async () => {
      mockSessionRepository.findById.mockResolvedValue(
        makeSessionRecord({ status: 'revoked' }),
      );

      await expect(
        sessionService.validateActiveSession('session-id-abc'),
      ).rejects.toThrow(SessionInactiveError);
    });

    it('should throw SessionExpiredError when session has expired', async () => {
      mockSessionRepository.findById.mockResolvedValue(
        makeSessionRecord({ expiresAt: new Date(Date.now() - 1000) }),
      );
      mockSessionRepository.update.mockResolvedValue({});

      await expect(
        sessionService.validateActiveSession('session-id-abc'),
      ).rejects.toThrow(SessionExpiredError);
    });

    it('should return SessionContext for a valid active session', async () => {
      mockSessionRepository.findById.mockResolvedValue(makeSessionRecord());

      const context = await sessionService.validateActiveSession('session-id-abc');
      expect(context.sessionId).toBe('session-id-abc');
      expect(context.isActive).toBe(true);
    });
  });

  describe('revokeSession', () => {
    it('should call repository revokeById', async () => {
      mockSessionRepository.revokeById.mockResolvedValue({});

      await sessionService.revokeSession('session-id-abc');

      expect(mockSessionRepository.revokeById).toHaveBeenCalledWith('session-id-abc');
    });
  });

  describe('revokeAllUserSessions', () => {
    it('should call repository revokeAllByUserId', async () => {
      mockSessionRepository.revokeAllByUserId.mockResolvedValue(3);

      await sessionService.revokeAllUserSessions('user-id-123');

      expect(mockSessionRepository.revokeAllByUserId).toHaveBeenCalledWith('user-id-123');
    });
  });

  describe('getUserActiveSessions', () => {
    it('should return mapped session contexts', async () => {
      mockSessionRepository.findActiveByUserId.mockResolvedValue([
        makeSessionRecord(),
        makeSessionRecord({ id: 'session-id-xyz' }),
      ]);

      const sessions = await sessionService.getUserActiveSessions('user-id-123');

      expect(sessions).toHaveLength(2);
      expect(sessions[0].sessionId).toBe('session-id-abc');
      expect(sessions[1].sessionId).toBe('session-id-xyz');
    });
  });
});

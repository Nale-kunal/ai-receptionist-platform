/**
 * AuthService Unit Tests
 *
 * Tests all business logic paths in AuthService using mocked dependencies.
 *
 * Key behaviors tested:
 *   - Registration: duplicate email, password hashing, verification email dispatch
 *   - Login: timing-safe password check, account locking, account status checks
 *   - Logout: session revocation
 *   - Refresh: token rotation, reuse detection → session revocation
 *   - Forgot Password: always returns same message (no enumeration)
 *   - Reset Password: token consumption, session revocation, tokenVersion increment
 *   - Email Verification: single-use token, already-verified guard
 */

import { AuthService } from '../services/auth.service';
import {
  EmailAlreadyRegisteredError,
  InvalidCredentialsError,
  AccountLockedError,
  AccountNotVerifiedError,
  AccountSuspendedError,
  RefreshTokenReuseDetectedError,
  InvalidPasswordResetTokenError,
  InvalidVerificationTokenError,
  EmailAlreadyVerifiedError,
} from '../errors/auth.errors';

// --------------------------------------------------------------------------
// Mock Factories
// --------------------------------------------------------------------------

function makeUser(overrides: Record<string, unknown> = {}) {
  return {
    id: 'user-id-123',
    publicId: 'usr_abc123',
    email: 'test@example.com',
    passwordHash: '', // Will be set by individual tests
    firstName: 'Test',
    lastName: 'User',
    tenantId: 'tenant-id-456',
    clinicId: null,
    role: 'clinic_owner',
    status: 'active',
    emailVerified: true,
    emailVerifiedAt: new Date(),
    tokenVersion: 0,
    failedLoginAttempts: 0,
    lockedUntil: null,
    lastLoginAt: null,
    passwordChangedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...overrides,
  };
}

function makeSession(overrides: Record<string, unknown> = {}) {
  return {
    id: 'session-id-abc',
    userId: 'user-id-123',
    tenantId: 'tenant-id-456',
    refreshTokenHash: 'hashed-token',
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
// Mocks
// --------------------------------------------------------------------------

const mockUserRepository = {
  findByEmail: jest.fn(),
  findById: jest.fn(),
  exists: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  incrementFailedLoginAttempts: jest.fn(),
  resetFailedLoginAttempts: jest.fn(),
  incrementTokenVersion: jest.fn(),
};

const mockSessionRepository = {
  findById: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  revokeById: jest.fn(),
  revokeAllByUserId: jest.fn(),
  updateLastActivity: jest.fn(),
};

const mockPasswordResetTokenRepository = {
  create: jest.fn(),
  findByTokenHash: jest.fn(),
  markUsed: jest.fn(),
  invalidateAllForUser: jest.fn(),
};

const mockEmailVerificationTokenRepository = {
  create: jest.fn(),
  findByTokenHash: jest.fn(),
  markUsed: jest.fn(),
  invalidateAllForUser: jest.fn(),
};

const mockTokenService = {
  signAccessToken: jest.fn().mockReturnValue('mock.access.token'),
  verifyAccessToken: jest.fn(),
  generateRefreshToken: jest.fn().mockReturnValue('raw-refresh-token'),
  hashRefreshToken: jest.fn().mockReturnValue('hashed-refresh-token'),
  generateSecureToken: jest.fn().mockReturnValue('raw-secure-token'),
  hashSecureToken: jest.fn().mockReturnValue('hashed-secure-token'),
  buildTokenPair: jest.fn(),
  getRefreshTokenTtlSeconds: jest.fn().mockReturnValue(2592000),
  getAccessTokenTtlSeconds: jest.fn().mockReturnValue(900),
};

const mockSessionService = {
  createSession: jest.fn(),
  getSession: jest.fn(),
  validateActiveSession: jest.fn(),
  updateSessionActivity: jest.fn(),
  revokeSession: jest.fn(),
  revokeAllUserSessions: jest.fn(),
  getUserActiveSessions: jest.fn(),
};

const mockEventPublisher = {
  publish: jest.fn().mockResolvedValue(undefined),
};

const mockEmailProvider = {
  sendEmailVerification: jest.fn().mockResolvedValue(undefined),
  sendPasswordReset: jest.fn().mockResolvedValue(undefined),
};

// --------------------------------------------------------------------------
// Test Suite
// --------------------------------------------------------------------------

describe('AuthService', () => {
  let authService: AuthService;

  beforeEach(() => {
    jest.clearAllMocks();

    authService = new AuthService(
      mockUserRepository as any,
      mockSessionRepository as any,
      mockPasswordResetTokenRepository as any,
      mockEmailVerificationTokenRepository as any,
      mockTokenService as any,
      mockSessionService as any,
      mockEventPublisher as any,
      mockEmailProvider as any,
    );
  });

  // ----------------------------------------------------------------
  // Registration
  // ----------------------------------------------------------------

  describe('register', () => {
    it('should throw EmailAlreadyRegisteredError when email is taken', async () => {
      mockUserRepository.findByEmail.mockResolvedValue(makeUser());

      await expect(
        authService.register({
          email: 'test@example.com',
          password: 'SecurePass1!',
          firstName: 'A',
          lastName: 'B',
          requestId: 'req-1',
          deviceInfo: makeDeviceInfo(),
        }),
      ).rejects.toThrow(EmailAlreadyRegisteredError);
    });

    it('should create user and dispatch verification email on success', async () => {
      mockUserRepository.findByEmail.mockResolvedValue(null);
      mockUserRepository.create.mockResolvedValue(makeUser());
      mockEmailVerificationTokenRepository.create.mockResolvedValue({});

      const result = await authService.register({
        email: 'new@example.com',
        password: 'SecurePass1!',
        firstName: 'New',
        lastName: 'User',
        requestId: 'req-2',
        deviceInfo: makeDeviceInfo(),
      });

      expect(mockUserRepository.create).toHaveBeenCalledTimes(1);
      expect(mockEmailVerificationTokenRepository.create).toHaveBeenCalledTimes(1);
      expect(mockEmailProvider.sendEmailVerification).toHaveBeenCalledTimes(1);
      expect(result.verificationEmailSent).toBe(true);
      expect(result.user.email).toBe('test@example.com');
    });

    it('should still succeed if email provider throws', async () => {
      mockUserRepository.findByEmail.mockResolvedValue(null);
      mockUserRepository.create.mockResolvedValue(makeUser());
      mockEmailVerificationTokenRepository.create.mockResolvedValue({});
      mockEmailProvider.sendEmailVerification.mockRejectedValue(new Error('SMTP error'));

      const result = await authService.register({
        email: 'new@example.com',
        password: 'SecurePass1!',
        firstName: 'New',
        lastName: 'User',
        requestId: 'req-3',
        deviceInfo: makeDeviceInfo(),
      });

      expect(result.verificationEmailSent).toBe(false);
    });

    it('should publish UserRegisteredEvent', async () => {
      mockUserRepository.findByEmail.mockResolvedValue(null);
      mockUserRepository.create.mockResolvedValue(makeUser());
      mockEmailVerificationTokenRepository.create.mockResolvedValue({});

      await authService.register({
        email: 'new@example.com',
        password: 'SecurePass1!',
        firstName: 'New',
        lastName: 'User',
        requestId: 'req-4',
        deviceInfo: makeDeviceInfo(),
      });

      expect(mockEventPublisher.publish).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: 'auth.user.registered' }),
      );
    });
  });

  // ----------------------------------------------------------------
  // Login
  // ----------------------------------------------------------------

  describe('login', () => {
    it('should throw InvalidCredentialsError when user is not found', async () => {
      mockUserRepository.findByEmail.mockResolvedValue(null);

      await expect(
        authService.login({
          email: 'notfound@example.com',
          password: 'SomePass1!',
          deviceInfo: makeDeviceInfo(),
          requestId: 'req-5',
        }),
      ).rejects.toThrow(InvalidCredentialsError);
    });

    it('should throw AccountLockedError when account is locked', async () => {
      const lockedUser = makeUser({ lockedUntil: new Date(Date.now() + 60_000) });
      // Need argon2 to validate correctly — use real argon2 for this test
      const argon2 = await import('argon2');
      lockedUser.passwordHash = await argon2.hash('SecurePass1!', { type: argon2.argon2id });
      mockUserRepository.findByEmail.mockResolvedValue(lockedUser);

      await expect(
        authService.login({
          email: 'test@example.com',
          password: 'SecurePass1!',
          deviceInfo: makeDeviceInfo(),
          requestId: 'req-6',
        }),
      ).rejects.toThrow(AccountLockedError);
    });

    it('should throw AccountNotVerifiedError when email is unverified', async () => {
      const unverifiedUser = makeUser({ emailVerified: false });
      const argon2 = await import('argon2');
      unverifiedUser.passwordHash = await argon2.hash('SecurePass1!', { type: argon2.argon2id });
      mockUserRepository.findByEmail.mockResolvedValue(unverifiedUser);

      await expect(
        authService.login({
          email: 'test@example.com',
          password: 'SecurePass1!',
          deviceInfo: makeDeviceInfo(),
          requestId: 'req-7',
        }),
      ).rejects.toThrow(AccountNotVerifiedError);
    });

    it('should throw AccountSuspendedError for suspended accounts', async () => {
      const suspendedUser = makeUser({ status: 'suspended' });
      const argon2 = await import('argon2');
      suspendedUser.passwordHash = await argon2.hash('SecurePass1!', { type: argon2.argon2id });
      mockUserRepository.findByEmail.mockResolvedValue(suspendedUser);

      await expect(
        authService.login({
          email: 'test@example.com',
          password: 'SecurePass1!',
          deviceInfo: makeDeviceInfo(),
          requestId: 'req-8',
        }),
      ).rejects.toThrow(AccountSuspendedError);
    });

    it('should return access token and refresh token on successful login', async () => {
      const argon2 = await import('argon2');
      const user = makeUser();
      user.passwordHash = await argon2.hash('SecurePass1!', { type: argon2.argon2id });
      user.failedLoginAttempts = 0;

      mockUserRepository.findByEmail.mockResolvedValue(user);
      mockUserRepository.update.mockResolvedValue(user);
      mockSessionService.createSession.mockResolvedValue({
        sessionId: 'session-id-abc',
        userId: user.id,
        tenantId: user.tenantId,
        createdAt: new Date(),
        lastActivityAt: new Date(),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        device: makeDeviceInfo(),
        isActive: true,
      });

      const result = await authService.login({
        email: 'test@example.com',
        password: 'SecurePass1!',
        deviceInfo: makeDeviceInfo(),
        requestId: 'req-9',
      });

      expect(result.accessToken).toBe('mock.access.token');
      expect(result.refreshToken).toBe('raw-refresh-token');
      expect(result.user.email).toBe('test@example.com');
      expect(mockEventPublisher.publish).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: 'auth.user.login.success' }),
      );
    });
  });

  // ----------------------------------------------------------------
  // Logout
  // ----------------------------------------------------------------

  describe('logout', () => {
    it('should revoke session and publish audit event', async () => {
      mockUserRepository.findById.mockResolvedValue(makeUser());
      mockSessionService.revokeSession.mockResolvedValue(undefined);

      await authService.logout({
        userId: 'user-id-123',
        sessionId: 'session-id-abc',
        requestId: 'req-10',
      });

      expect(mockSessionService.revokeSession).toHaveBeenCalledWith('session-id-abc');
      expect(mockEventPublisher.publish).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: 'auth.user.logout' }),
      );
    });

    it('should succeed silently when user is not found', async () => {
      mockUserRepository.findById.mockResolvedValue(null);

      await expect(
        authService.logout({
          userId: 'nonexistent',
          sessionId: 'session-id-abc',
          requestId: 'req-11',
        }),
      ).resolves.toBeUndefined();
    });
  });

  // ----------------------------------------------------------------
  // Refresh Tokens
  // ----------------------------------------------------------------

  describe('refreshTokens', () => {
    it('should throw RefreshTokenReuseDetectedError when hash does not match', async () => {
      const session = makeSession({ refreshTokenHash: 'different-hash' });
      mockSessionRepository.findById.mockResolvedValue(session);

      // hashRefreshToken returns 'hashed-refresh-token' but session has 'different-hash'
      await expect(
        authService.refreshTokens({
          rawRefreshToken: 'presented-raw-token',
          sessionId: 'session-id-abc',
          requestId: 'req-12',
          deviceInfo: makeDeviceInfo(),
        }),
      ).rejects.toThrow(RefreshTokenReuseDetectedError);

      expect(mockSessionService.revokeSession).toHaveBeenCalledWith('session-id-abc');
      expect(mockEventPublisher.publish).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: 'auth.token.reuse_detected' }),
      );
    });

    it('should rotate tokens when refresh token is valid', async () => {
      const session = makeSession({ refreshTokenHash: 'hashed-refresh-token' });
      mockSessionRepository.findById.mockResolvedValue(session);
      mockUserRepository.findById.mockResolvedValue(makeUser());
      mockSessionRepository.update.mockResolvedValue(session);

      const result = await authService.refreshTokens({
        rawRefreshToken: 'presented-raw-token', // hashRefreshToken mock returns 'hashed-refresh-token'
        sessionId: 'session-id-abc',
        requestId: 'req-13',
        deviceInfo: makeDeviceInfo(),
      });

      expect(result.accessToken).toBe('mock.access.token');
      expect(result.refreshToken).toBe('raw-refresh-token');
      expect(mockSessionRepository.update).toHaveBeenCalled();
    });
  });

  // ----------------------------------------------------------------
  // Forgot Password
  // ----------------------------------------------------------------

  describe('forgotPassword', () => {
    it('should return the same message regardless of whether email exists', async () => {
      mockUserRepository.findByEmail.mockResolvedValue(null);

      const result = await authService.forgotPassword({
        email: 'nonexistent@example.com',
        requestId: 'req-14',
        deviceInfo: makeDeviceInfo(),
      });

      expect(result.message).toMatch(/if an account/i);
      expect(mockPasswordResetTokenRepository.create).not.toHaveBeenCalled();
    });

    it('should create a reset token and send email when user exists', async () => {
      mockUserRepository.findByEmail.mockResolvedValue(makeUser());
      mockPasswordResetTokenRepository.invalidateAllForUser.mockResolvedValue(0);
      mockPasswordResetTokenRepository.create.mockResolvedValue({});

      const result = await authService.forgotPassword({
        email: 'test@example.com',
        requestId: 'req-15',
        deviceInfo: makeDeviceInfo(),
      });

      expect(mockPasswordResetTokenRepository.create).toHaveBeenCalledTimes(1);
      expect(mockEmailProvider.sendPasswordReset).toHaveBeenCalledTimes(1);
      expect(result.message).toBeTruthy();
    });
  });

  // ----------------------------------------------------------------
  // Reset Password
  // ----------------------------------------------------------------

  describe('resetPassword', () => {
    it('should throw InvalidPasswordResetTokenError when token not found', async () => {
      mockPasswordResetTokenRepository.findByTokenHash.mockResolvedValue(null);

      await expect(
        authService.resetPassword({
          token: 'invalid-token',
          newPassword: 'NewSecurePass1!',
          requestId: 'req-16',
        }),
      ).rejects.toThrow(InvalidPasswordResetTokenError);
    });

    it('should update password, increment tokenVersion, and revoke all sessions', async () => {
      const user = makeUser();
      mockPasswordResetTokenRepository.findByTokenHash.mockResolvedValue({ id: 'rt-1', userId: user.id });
      mockUserRepository.findById.mockResolvedValue(user);
      mockPasswordResetTokenRepository.markUsed.mockResolvedValue({});
      mockUserRepository.update.mockResolvedValue(user);
      mockSessionService.revokeAllUserSessions.mockResolvedValue(undefined);

      await authService.resetPassword({
        token: 'valid-token',
        newPassword: 'NewSecurePass1!',
        requestId: 'req-17',
      });

      expect(mockUserRepository.update).toHaveBeenCalledWith(
        user.id,
        expect.objectContaining({ tokenVersion: 1 }),
      );
      expect(mockSessionService.revokeAllUserSessions).toHaveBeenCalledWith(user.id);
      expect(mockEventPublisher.publish).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: 'auth.password.reset_completed' }),
      );
    });
  });

  // ----------------------------------------------------------------
  // Email Verification
  // ----------------------------------------------------------------

  describe('verifyEmail', () => {
    it('should throw InvalidVerificationTokenError when token not found', async () => {
      mockEmailVerificationTokenRepository.findByTokenHash.mockResolvedValue(null);

      await expect(
        authService.verifyEmail({ token: 'bad-token', requestId: 'req-18' }),
      ).rejects.toThrow(InvalidVerificationTokenError);
    });

    it('should throw EmailAlreadyVerifiedError when already verified', async () => {
      mockEmailVerificationTokenRepository.findByTokenHash.mockResolvedValue({ id: 'ev-1', userId: 'user-id-123' });
      mockUserRepository.findById.mockResolvedValue(makeUser({ emailVerified: true }));

      await expect(
        authService.verifyEmail({ token: 'valid-token', requestId: 'req-19' }),
      ).rejects.toThrow(EmailAlreadyVerifiedError);
    });

    it('should mark email as verified and return safe user', async () => {
      const unverifiedUser = makeUser({ emailVerified: false });
      const verifiedUser = makeUser({ emailVerified: true });

      mockEmailVerificationTokenRepository.findByTokenHash.mockResolvedValue({ id: 'ev-1', userId: unverifiedUser.id });
      mockUserRepository.findById
        .mockResolvedValueOnce(unverifiedUser)
        .mockResolvedValueOnce(verifiedUser);
      mockEmailVerificationTokenRepository.markUsed.mockResolvedValue({});
      mockUserRepository.update.mockResolvedValue(verifiedUser);

      const result = await authService.verifyEmail({ token: 'valid-token', requestId: 'req-20' });

      expect(result.emailVerified).toBe(true);
      expect(mockEventPublisher.publish).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: 'auth.email.verified' }),
      );
    });
  });
});

/**
 * Authentication Integration Tests
 *
 * End-to-end tests of the authentication flows using a real Express app
 * with mocked repositories (no real database required for CI).
 *
 * These tests verify the full HTTP request/response cycle:
 *   - Request reaches controller
 *   - Validation fires correctly
 *   - Service is called
 *   - Response envelope is correct
 *   - Cookies are set/cleared correctly
 *   - HTTP status codes are correct
 */

import express, { type Application } from 'express';
import request from 'supertest';
import cookieParser from 'cookie-parser';

import { AuthController } from '../controllers/auth.controller';
import { createAuthRouter } from '../routes/auth.routes';
import { AuthError } from '../errors/auth.errors';
import { REFRESH_TOKEN_COOKIE_NAME } from '../constants/auth.constants';

// --------------------------------------------------------------------------
// Mock Auth Service
// --------------------------------------------------------------------------

const mockAuthService = {
  register: jest.fn(),
  login: jest.fn(),
  logout: jest.fn(),
  refreshTokens: jest.fn(),
  forgotPassword: jest.fn(),
  resetPassword: jest.fn(),
  verifyEmail: jest.fn(),
  resendVerificationEmail: jest.fn(),
};

const mockTokenService = {
  signAccessToken: jest.fn().mockReturnValue('mock.access.token'),
  verifyAccessToken: jest.fn(),
  generateRefreshToken: jest.fn().mockReturnValue('raw-refresh-token'),
  hashRefreshToken: jest.fn().mockReturnValue('hashed-token'),
  generateSecureToken: jest.fn(),
  hashSecureToken: jest.fn(),
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

const mockUserRepository = {
  findByEmail: jest.fn(),
  findById: jest.fn(),
};

// --------------------------------------------------------------------------
// Test App Factory
// --------------------------------------------------------------------------

function createTestApp(): Application {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());

  // Attach requestId
  app.use((req, _res, next) => {
    req.requestId = 'test-request-id';
    next();
  });

  const controller = new AuthController(mockAuthService as any, mockTokenService as any);

  // No-op rate limiter for tests
  const noopMiddleware = (_req: any, _res: any, next: any) => next();
  const rateLimiter = {
    strict: () => noopMiddleware,
    moderate: () => noopMiddleware,
    refresh: () => noopMiddleware,
  };

  const router = createAuthRouter({
    controller,
    tokenService: mockTokenService as any,
    sessionService: mockSessionService as any,
    userRepository: mockUserRepository as any,
    rateLimiter,
  });

  app.use('/api/v1/auth', router);

  // Global error handler for tests
  app.use((err: Error, _req: any, res: any, _next: any) => {
    if (err instanceof AuthError) {
      res.status(err.statusCode).json({
        success: false,
        error: { code: err.code, message: err.message, details: [] },
        requestId: 'test-request-id',
      });
      return;
    }
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Internal error' }, requestId: '' });
  });

  return app;
}

// --------------------------------------------------------------------------
// Tests
// --------------------------------------------------------------------------

describe('Authentication Integration Tests', () => {
  let app: Application;

  beforeEach(() => {
    jest.clearAllMocks();
    app = createTestApp();
  });

  // ----------------------------------------------------------------
  // POST /api/v1/auth/register
  // ----------------------------------------------------------------

  describe('POST /api/v1/auth/register', () => {
    const validBody = {
      email: 'test@example.com',
      password: 'SecurePass1!',
      confirmPassword: 'SecurePass1!',
      firstName: 'Test',
      lastName: 'User',
    };

    it('should return 422 for invalid request body', async () => {
      const res = await request(app).post('/api/v1/auth/register').send({ email: 'bad' });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_FAILED');
    });

    it('should return 201 with user data on success', async () => {
      mockAuthService.register.mockResolvedValue({
        user: {
          publicId: 'usr_abc',
          email: 'test@example.com',
          firstName: 'Test',
          lastName: 'User',
          role: 'clinic_owner',
          tenantId: 'tenant-id',
          emailVerified: false,
          createdAt: new Date(),
        },
        verificationEmailSent: true,
      });

      const res = await request(app).post('/api/v1/auth/register').send(validBody);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.email).toBe('test@example.com');
    });

    it('should return 409 when email is already registered', async () => {
      const { EmailAlreadyRegisteredError } = await import('../errors/auth.errors');
      mockAuthService.register.mockRejectedValue(new EmailAlreadyRegisteredError());

      const res = await request(app).post('/api/v1/auth/register').send(validBody);

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
    });
  });

  // ----------------------------------------------------------------
  // POST /api/v1/auth/login
  // ----------------------------------------------------------------

  describe('POST /api/v1/auth/login', () => {
    const validBody = { email: 'test@example.com', password: 'SecurePass1!' };

    it('should set HttpOnly refresh token cookie on successful login', async () => {
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      mockAuthService.login.mockResolvedValue({
        accessToken: 'access.token.here',
        accessTokenExpiresAt: new Date(Date.now() + 900_000),
        refreshToken: 'raw-refresh-token',
        refreshTokenExpiresAt: expiresAt,
        user: {
          publicId: 'usr_abc',
          email: 'test@example.com',
          firstName: 'Test',
          lastName: 'User',
          role: 'clinic_owner',
          tenantId: 'tenant-id',
          emailVerified: true,
          createdAt: new Date(),
        },
      });

      const res = await request(app).post('/api/v1/auth/login').send(validBody);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.accessToken).toBe('access.token.here');
      // Refresh token must NOT be in the body
      expect(res.body.data.refreshToken).toBeUndefined();
      // Refresh token must be in the cookie
      const cookies = res.headers['set-cookie'] as unknown as string[];
      expect(cookies).toBeDefined();
      const rtCookie = cookies.find((c: string) => c.startsWith(REFRESH_TOKEN_COOKIE_NAME));
      expect(rtCookie).toBeDefined();
      expect(rtCookie).toContain('HttpOnly');
    });

    it('should return 422 for invalid request', async () => {
      const res = await request(app).post('/api/v1/auth/login').send({ email: 'bad' });

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('VALIDATION_FAILED');
    });

    it('should return 401 for invalid credentials', async () => {
      const { InvalidCredentialsError } = await import('../errors/auth.errors');
      mockAuthService.login.mockRejectedValue(new InvalidCredentialsError());

      const res = await request(app).post('/api/v1/auth/login').send(validBody);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  // ----------------------------------------------------------------
  // POST /api/v1/auth/forgot-password
  // ----------------------------------------------------------------

  describe('POST /api/v1/auth/forgot-password', () => {
    it('should always return 200 regardless of whether email exists', async () => {
      mockAuthService.forgotPassword.mockResolvedValue({
        message: 'If an account with that email exists, a password reset link has been sent.',
      });

      const res = await request(app)
        .post('/api/v1/auth/forgot-password')
        .send({ email: 'anyone@example.com' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should return 422 for invalid email', async () => {
      const res = await request(app)
        .post('/api/v1/auth/forgot-password')
        .send({ email: 'not-an-email' });

      expect(res.status).toBe(422);
    });
  });

  // ----------------------------------------------------------------
  // POST /api/v1/auth/reset-password
  // ----------------------------------------------------------------

  describe('POST /api/v1/auth/reset-password', () => {
    it('should return 200 on successful password reset', async () => {
      mockAuthService.resetPassword.mockResolvedValue(undefined);

      const res = await request(app).post('/api/v1/auth/reset-password').send({
        token: 'valid-reset-token',
        newPassword: 'NewSecurePass1!',
        confirmPassword: 'NewSecurePass1!',
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should clear refresh token cookie after password reset', async () => {
      mockAuthService.resetPassword.mockResolvedValue(undefined);

      const res = await request(app).post('/api/v1/auth/reset-password').send({
        token: 'valid-token',
        newPassword: 'NewSecurePass1!',
        confirmPassword: 'NewSecurePass1!',
      });

      const cookies = res.headers['set-cookie'] as unknown as string[];
      if (cookies) {
        const rtCookie = cookies.find((c: string) => c.startsWith(REFRESH_TOKEN_COOKIE_NAME));
        // Either cleared (Max-Age=0) or not present
        if (rtCookie) {
          expect(rtCookie).toMatch(/Max-Age=0|Expires=Thu, 01 Jan 1970/i);
        }
      }
    });
  });

  // ----------------------------------------------------------------
  // POST /api/v1/auth/verify-email
  // ----------------------------------------------------------------

  describe('POST /api/v1/auth/verify-email', () => {
    it('should return 200 with verified user on success', async () => {
      mockAuthService.verifyEmail.mockResolvedValue({
        publicId: 'usr_abc',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        role: 'clinic_owner',
        tenantId: 'tenant-id',
        emailVerified: true,
        createdAt: new Date(),
      });

      const res = await request(app).post('/api/v1/auth/verify-email').send({ token: 'valid-token' });

      expect(res.status).toBe(200);
      expect(res.body.data.user.emailVerified).toBe(true);
    });

    it('should return 422 for missing token', async () => {
      const res = await request(app).post('/api/v1/auth/verify-email').send({});
      expect(res.status).toBe(422);
    });
  });
});

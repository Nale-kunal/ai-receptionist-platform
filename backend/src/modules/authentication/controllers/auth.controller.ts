/**
 * Authentication Controller
 *
 * Transport adapter only. Responsible for:
 *   1. Extracting data from HTTP requests
 *   2. Parsing device info
 *   3. Validating DTOs via Zod schemas
 *   4. Calling AuthService
 *   5. Setting HttpOnly cookies
 *   6. Returning standardized API responses
 *
 * Controllers MUST NOT:
 *   - Access the database
 *   - Contain business rules
 *   - Call external providers directly
 *
 * Per Implementation Principles §5 (Controller Contract) and
 * API Contract §Response Format.
 *
 * Response envelope:
 *   Success: { success: true, data: {}, meta: {}, requestId: "" }
 *   Failure: { success: false, error: { code, message, details }, requestId: "" }
 */

import type { Request, Response, NextFunction } from 'express';
import type { AuthService } from '../services/auth.service';
import type { TokenService } from '../services/token.service';
import type { DeviceInfo } from '../types/auth.types';

import { RegisterSchema } from '../validators/register.validator';
import { LoginSchema } from '../validators/login.validator';
import { RefreshTokenSchema } from '../validators/refresh-token.validator';
import { ForgotPasswordSchema } from '../validators/forgot-password.validator';
import { ResetPasswordSchema } from '../validators/reset-password.validator';
import { VerifyEmailSchema } from '../validators/verify-email.validator';
import { ResendVerificationSchema } from '../validators/resend-verification.validator';

import { REFRESH_TOKEN_COOKIE_NAME, REFRESH_TOKEN_TTL_SECONDS } from '../constants/auth.constants';
import { AuthError } from '../errors/auth.errors';

// --------------------------------------------------------------------------
// Device Info Parser
// --------------------------------------------------------------------------

function parseDeviceInfo(req: Request): DeviceInfo {
  const userAgent = req.headers['user-agent'] ?? 'unknown';
  const ipAddress = (
    (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ??
    req.socket?.remoteAddress ??
    'unknown'
  );

  // Best-effort device type detection from User-Agent
  const uaLower = userAgent.toLowerCase();
  let deviceType: DeviceInfo['deviceType'] = 'desktop';
  if (/mobile|android|iphone|ipod/.test(uaLower)) {
    deviceType = 'mobile';
  } else if (/tablet|ipad/.test(uaLower)) {
    deviceType = 'tablet';
  }

  return {
    userAgent,
    ipAddress,
    browser: null, // Full parsing requires ua-parser-js — left for future integration
    operatingSystem: null,
    deviceType,
  };
}

// --------------------------------------------------------------------------
// Response Helpers
// --------------------------------------------------------------------------

function sendSuccess(res: Response, data: unknown, statusCode = 200, meta?: unknown): void {
  res.status(statusCode).json({
    success: true,
    data,
    ...(meta ? { meta } : {}),
    requestId: (res.req as Request).requestId ?? '',
  });
}

function sendValidationError(res: Response, details: Array<{ field: string; message: string }>, requestId: string): void {
  res.status(422).json({
    success: false,
    error: {
      code: 'VALIDATION_FAILED',
      message: 'Request validation failed.',
      details,
    },
    requestId,
  });
}

// --------------------------------------------------------------------------
// Refresh Token Cookie Helper
// --------------------------------------------------------------------------

function setRefreshTokenCookie(res: Response, token: string, expiresAt: Date): void {
  res.cookie(REFRESH_TOKEN_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env['NODE_ENV'] === 'production',
    sameSite: 'lax',
    expires: expiresAt,
    path: '/',
  });
}

function clearRefreshTokenCookie(res: Response): void {
  res.clearCookie(REFRESH_TOKEN_COOKIE_NAME, {
    httpOnly: true,
    secure: process.env['NODE_ENV'] === 'production',
    sameSite: 'lax',
    path: '/',
  });
}

// --------------------------------------------------------------------------
// Controller
// --------------------------------------------------------------------------

export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly tokenService: TokenService,
    private readonly permissionEvaluator?: any,
    private readonly userRepository?: any,
  ) {}

  // POST /api/v1/auth/register
  async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const requestId = req.requestId ?? '';
      const parseResult = RegisterSchema.safeParse(req.body);

      if (!parseResult.success) {
        const details = parseResult.error.errors.map((e) => ({
          field: e.path.join('.'),
          message: e.message,
        }));
        sendValidationError(res, details, requestId);
        return;
      }

      const dto = parseResult.data;
      const deviceInfo = parseDeviceInfo(req);

      const result = await this.authService.register({
        email: dto.email,
        password: dto.password,
        firstName: dto.firstName,
        lastName: dto.lastName,
        tenantId: dto.tenantId,
        requestId,
        deviceInfo,
      });

      sendSuccess(
        res,
        {
          user: result.user,
          verificationEmailSent: result.verificationEmailSent,
          message: 'Account created. Please verify your email address.',
        },
        201,
      );
    } catch (error) {
      next(error);
    }
  }

  // POST /api/v1/auth/login
  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const requestId = req.requestId ?? '';
      const parseResult = LoginSchema.safeParse(req.body);

      if (!parseResult.success) {
        const details = parseResult.error.errors.map((e) => ({
          field: e.path.join('.'),
          message: e.message,
        }));
        sendValidationError(res, details, requestId);
        return;
      }

      const dto = parseResult.data;
      const deviceInfo = parseDeviceInfo(req);

      const result = await this.authService.login({
        email: dto.email,
        password: dto.password,
        deviceInfo,
        requestId,
      });

      // Set refresh token as HttpOnly cookie — never expose in response body
      setRefreshTokenCookie(res, result.refreshToken, result.refreshTokenExpiresAt);

      sendSuccess(res, {
        accessToken: result.accessToken,
        accessTokenExpiresAt: result.accessTokenExpiresAt,
        // refreshToken is NOT included in body — HttpOnly cookie only
        user: result.user,
        roles: result.roles || [result.user.role],
        permissions: result.permissions || ['*'],
      });
    } catch (error) {
      next(error);
    }
  }

  // POST /api/v1/auth/logout
  async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const requestId = req.requestId ?? '';
      const user = req.user;

      if (!user) {
        res.status(401).json({
          success: false,
          error: { code: 'AUTH_REQUIRED', message: 'Authentication required.', details: [] },
          requestId,
        });
        return;
      }

      await this.authService.logout({
        userId: user.userId,
        sessionId: user.sessionId,
        requestId,
      });

      clearRefreshTokenCookie(res);

      sendSuccess(res, { message: 'Successfully logged out.' });
    } catch (error) {
      next(error);
    }
  }

  // POST /api/v1/auth/refresh
  async refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const requestId = req.requestId ?? '';

      // Prefer cookie (browser clients) then fall back to body (API clients)
      const cookieToken = req.cookies?.[REFRESH_TOKEN_COOKIE_NAME] as string | undefined;
      const bodyToken = req.body?.refreshToken as string | undefined;
      const rawRefreshToken = cookieToken ?? bodyToken;

      if (!rawRefreshToken) {
        res.status(401).json({
          success: false,
          error: { code: 'AUTH_MISSING_REFRESH_TOKEN', message: 'Refresh token is required.', details: [] },
          requestId,
        });
        return;
      }

      // Session ID must be extracted from expired/current access token header for context
      // For stateless refresh, the sessionId is embedded in the refresh request body
      const sessionId = req.body?.sessionId as string | undefined;
      if (!sessionId) {
        res.status(401).json({
          success: false,
          error: { code: 'AUTH_MISSING_SESSION_ID', message: 'Session ID is required.', details: [] },
          requestId,
        });
        return;
      }

      const deviceInfo = parseDeviceInfo(req);

      const result = await this.authService.refreshTokens({
        rawRefreshToken,
        sessionId,
        requestId,
        deviceInfo,
      });

      // Rotate the cookie with the new refresh token (if re-issued)
      if (result.refreshToken) {
        setRefreshTokenCookie(res, result.refreshToken, result.refreshTokenExpiresAt);
      }

      sendSuccess(res, {
        accessToken: result.accessToken,
        accessTokenExpiresAt: result.accessTokenExpiresAt,
        // New refresh token is in the cookie, not the body
      });
    } catch (error) {
      next(error);
    }
  }

  // POST /api/v1/auth/forgot-password
  async forgotPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const requestId = req.requestId ?? '';
      const parseResult = ForgotPasswordSchema.safeParse(req.body);

      if (!parseResult.success) {
        const details = parseResult.error.errors.map((e) => ({
          field: e.path.join('.'),
          message: e.message,
        }));
        sendValidationError(res, details, requestId);
        return;
      }

      const deviceInfo = parseDeviceInfo(req);
      const result = await this.authService.forgotPassword({
        email: parseResult.data.email,
        requestId,
        deviceInfo,
      });

      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }

  // POST /api/v1/auth/reset-password
  async resetPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const requestId = req.requestId ?? '';
      const parseResult = ResetPasswordSchema.safeParse(req.body);

      if (!parseResult.success) {
        const details = parseResult.error.errors.map((e) => ({
          field: e.path.join('.'),
          message: e.message,
        }));
        sendValidationError(res, details, requestId);
        return;
      }

      await this.authService.resetPassword({
        token: parseResult.data.token,
        newPassword: parseResult.data.newPassword,
        requestId,
      });

      // Clear refresh token cookie — all sessions were revoked by reset
      clearRefreshTokenCookie(res);

      sendSuccess(res, {
        message: 'Password has been reset. Please log in with your new password.',
      });
    } catch (error) {
      next(error);
    }
  }

  // POST /api/v1/auth/verify-email
  async verifyEmail(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const requestId = req.requestId ?? '';
      const parseResult = VerifyEmailSchema.safeParse(req.body);

      if (!parseResult.success) {
        const details = parseResult.error.errors.map((e) => ({
          field: e.path.join('.'),
          message: e.message,
        }));
        sendValidationError(res, details, requestId);
        return;
      }

      const updatedUser = await this.authService.verifyEmail({
        token: parseResult.data.token,
        requestId,
      });

      sendSuccess(res, {
        user: updatedUser,
        message: 'Email verified successfully.',
      });
    } catch (error) {
      next(error);
    }
  }

  // POST /api/v1/auth/resend-verification
  async resendVerification(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const requestId = req.requestId ?? '';
      const parseResult = ResendVerificationSchema.safeParse(req.body);

      if (!parseResult.success) {
        const details = parseResult.error.errors.map((e) => ({
          field: e.path.join('.'),
          message: e.message,
        }));
        sendValidationError(res, details, requestId);
        return;
      }

      await this.authService.resendVerificationEmail({
        email: parseResult.data.email,
        requestId,
      });

      // Always return the same message — prevents email enumeration
      sendSuccess(res, {
        message: 'If an unverified account with that email exists, a new verification link has been sent.',
      });
    } catch (error) {
      next(error);
    }
  }

  // GET /api/v1/auth/me
  async me(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const requestId = req.requestId ?? '';
      const userPayload = req.user;

      if (!userPayload || !this.userRepository || !this.permissionEvaluator) {
        res.status(401).json({
          success: false,
          error: { code: 'AUTH_REQUIRED', message: 'Authentication required.', details: [] },
          requestId,
        });
        return;
      }

      const user = await this.userRepository.findByIdWithRelations(userPayload.userId);
      if (!user) {
        res.status(401).json({
          success: false,
          error: { code: 'AUTH_REQUIRED', message: 'User session not found.', details: [] },
          requestId,
        });
        return;
      }

      const resolved = await this.permissionEvaluator.resolvePermissions({
        userId: user.id,
        tenantId: user.tenantId,
        clinicId: user.clinicId,
        role: user.role,
      });

      sendSuccess(res, {
        user: {
          id: user.id,
          publicId: user.publicId,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          status: user.status,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        },
        roles: resolved.roleNames,
        permissions: Array.from(resolved.permissions),
        tenant: user.tenant ? {
          id: user.tenant.id,
          publicId: user.tenant.publicId,
          name: user.tenant.name,
          slug: user.tenant.slug,
          subscriptionPlan: user.tenant.subscriptionPlan,
          status: user.tenant.status,
        } : null,
        clinic: user.clinic ? {
          id: user.clinic.id,
          publicId: user.clinic.publicId,
          name: user.clinic.name,
          slug: user.clinic.slug,
          status: user.clinic.status,
        } : null,
        subscription: user.tenant ? {
          plan: user.tenant.subscriptionPlan,
          status: user.tenant.status,
        } : null,
      });
    } catch (error) {
      next(error);
    }
  }

  // GET /api/v1/auth/session
  // Session probe endpoint: returns 200 OK for both authenticated and unauthenticated visitors
  // Prevents network 401 console errors on initial load while maintaining Zero Trust security
  async session(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const requestId = req.requestId ?? '';
      const authHeader = req.headers.authorization;
      const cookieToken = req.cookies?.[REFRESH_TOKEN_COOKIE_NAME] as string | undefined;

      if (!authHeader && !cookieToken) {
        sendSuccess(res, { authenticated: false, user: null });
        return;
      }

      if (authHeader && authHeader.startsWith('Bearer ') && this.tokenService && this.userRepository && this.permissionEvaluator) {
        const rawToken = authHeader.slice(7);
        try {
          const payload = this.tokenService.verifyAccessToken(rawToken);
          const user = await this.userRepository.findByIdWithRelations(payload.sub);
          if (user && user.tokenVersion === payload.tokenVersion) {
            const resolved = await this.permissionEvaluator.resolvePermissions({
              userId: user.id,
              tenantId: user.tenantId,
              clinicId: user.clinicId,
              role: user.role,
            });

            sendSuccess(res, {
              authenticated: true,
              accessToken: rawToken,
              user: {
                id: user.id,
                publicId: user.publicId,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                role: user.role,
                status: user.status,
                createdAt: user.createdAt,
                updatedAt: user.updatedAt,
              },
              roles: resolved.roleNames,
              permissions: Array.from(resolved.permissions),
              tenant: user.tenant ? {
                id: user.tenant.id,
                publicId: user.tenant.publicId,
                name: user.tenant.name,
                slug: user.tenant.slug,
                subscriptionPlan: user.tenant.subscriptionPlan,
                status: user.tenant.status,
              } : null,
              clinic: user.clinic ? {
                id: user.clinic.id,
                publicId: user.clinic.publicId,
                name: user.clinic.name,
                slug: user.clinic.slug,
                status: user.clinic.status,
              } : null,
            });
            return;
          }
        } catch {
          // Token verification failed — proceed to cookie check
        }
      }

      if (cookieToken && this.authService && this.userRepository && this.permissionEvaluator) {
        try {
          const deviceInfo = parseDeviceInfo(req);
          const refreshResult = await this.authService.refreshTokens({
            rawRefreshToken: cookieToken,
            sessionId: req.body?.sessionId || 'auto-restore',
            requestId,
            deviceInfo,
          });

          if (refreshResult.refreshToken) {
            setRefreshTokenCookie(res, refreshResult.refreshToken, refreshResult.refreshTokenExpiresAt);
          }

          const payload = this.tokenService.verifyAccessToken(refreshResult.accessToken);
          const user = await this.userRepository.findByIdWithRelations(payload.sub);
          if (user) {
            const resolved = await this.permissionEvaluator.resolvePermissions({
              userId: user.id,
              tenantId: user.tenantId,
              clinicId: user.clinicId,
              role: user.role,
            });

            sendSuccess(res, {
              authenticated: true,
              accessToken: refreshResult.accessToken,
              user: {
                id: user.id,
                publicId: user.publicId,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                role: user.role,
                status: user.status,
                createdAt: user.createdAt,
                updatedAt: user.updatedAt,
              },
              roles: resolved.roleNames,
              permissions: Array.from(resolved.permissions),
              tenant: user.tenant ? {
                id: user.tenant.id,
                publicId: user.tenant.publicId,
                name: user.tenant.name,
                slug: user.tenant.slug,
                subscriptionPlan: user.tenant.subscriptionPlan,
                status: user.tenant.status,
              } : null,
              clinic: user.clinic ? {
                id: user.clinic.id,
                publicId: user.clinic.publicId,
                name: user.clinic.name,
                slug: user.clinic.slug,
                status: user.clinic.status,
              } : null,
            });
            return;
          }
        } catch (err) {
          console.error('[auth.controller] session refresh error:', err);
          clearRefreshTokenCookie(res);
          sendSuccess(res, { authenticated: false, user: null });
          return;
        }
      }

      sendSuccess(res, { authenticated: false, user: null });
    } catch (error) {
      next(error);
    }
  }
}

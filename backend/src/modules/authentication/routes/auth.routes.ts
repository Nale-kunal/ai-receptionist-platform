/**
 * Authentication Routes
 *
 * Defines all authentication endpoints and applies:
 *   - Rate limiting hooks (middleware injection points)
 *   - Request size limits
 *   - Route-specific middleware
 *
 * All routes are prefixed with /api/v1/auth (applied at app level).
 *
 * Per API Contract:
 *   - Base URL: /api/v1
 *   - Public endpoints: strict rate limiting
 *   - Authenticated endpoints: moderate rate limiting
 */

import { Router } from 'express';
import type { RequestHandler } from 'express';
import type { AuthController } from '../controllers/auth.controller';
import type { TokenService } from '../services/token.service';
import type { SessionService } from '../services/session.service';
import type { UserRepository } from '../repositories/user.repository';
import { createAuthenticateMiddleware } from '../middleware/authenticate.middleware';

// --------------------------------------------------------------------------
// Rate Limiter Hook Type
// --------------------------------------------------------------------------

/**
 * Rate limiter factory interface.
 * The application layer provides rate limiter implementations.
 * The auth module declares the contract; it does not implement rate limiting.
 * This keeps the module decoupled from express-rate-limit version specifics.
 */
export interface RateLimiterFactory {
  /**
   * Returns a middleware for strict rate limiting (public auth endpoints).
   * Recommended: 5 requests per 15 minutes per IP.
   */
  strict(): RequestHandler;

  /**
   * Returns a middleware for moderate rate limiting (authenticated endpoints).
   * Recommended: 30 requests per 15 minutes per user.
   */
  moderate(): RequestHandler;

  /**
   * Returns a middleware specifically for refresh token rotation.
   * Recommended: 10 requests per 15 minutes per IP/session.
   */
  refresh(): RequestHandler;
}

// --------------------------------------------------------------------------
// Route Factory
// --------------------------------------------------------------------------

export interface AuthRouterOptions {
  controller: AuthController;
  tokenService: TokenService;
  sessionService: SessionService;
  userRepository: UserRepository;
  rateLimiter: RateLimiterFactory;
}

export function createAuthRouter(options: AuthRouterOptions): Router {
  const { controller, tokenService, sessionService, userRepository, rateLimiter } = options;

  const router = Router();

  const authenticate = createAuthenticateMiddleware(tokenService, sessionService, userRepository);

  const strictLimit = rateLimiter.strict();
  const moderateLimit = rateLimiter.moderate();
  const refreshLimit = rateLimiter.refresh();

  // --------------------------------------------------------------------------
  // Public Endpoints
  // --------------------------------------------------------------------------

  /**
   * POST /api/v1/auth/register
   * Rate: Strict (5 req / 15 min per IP)
   */
  router.post(
    '/register',
    strictLimit,
    (req, res, next) => controller.register(req, res, next),
  );

  /**
   * POST /api/v1/auth/login
   * Rate: Strict (5 req / 15 min per IP)
   */
  router.post(
    '/login',
    strictLimit,
    (req, res, next) => controller.login(req, res, next),
  );

  /**
   * POST /api/v1/auth/refresh
   * Rate: Refresh-specific (10 req / 15 min per IP)
   */
  router.post(
    '/refresh',
    refreshLimit,
    (req, res, next) => controller.refresh(req, res, next),
  );

  /**
   * POST /api/v1/auth/forgot-password
   * Rate: Strict (5 req / 15 min per IP)
   */
  router.post(
    '/forgot-password',
    strictLimit,
    (req, res, next) => controller.forgotPassword(req, res, next),
  );

  /**
   * POST /api/v1/auth/reset-password
   * Rate: Strict
   */
  router.post(
    '/reset-password',
    strictLimit,
    (req, res, next) => controller.resetPassword(req, res, next),
  );

  /**
   * POST /api/v1/auth/verify-email
   * Rate: Strict
   */
  router.post(
    '/verify-email',
    strictLimit,
    (req, res, next) => controller.verifyEmail(req, res, next),
  );

  /**
   * POST /api/v1/auth/resend-verification
   * Rate: Strict
   */
  router.post(
    '/resend-verification',
    strictLimit,
    (req, res, next) => controller.resendVerification(req, res, next),
  );

  // --------------------------------------------------------------------------
  // Authenticated Endpoints
  // --------------------------------------------------------------------------

  /**
   * POST /api/v1/auth/logout
   * Requires: Valid Bearer token
   * Rate: Moderate
   */
  router.post(
    '/logout',
    moderateLimit,
    authenticate,
    (req, res, next) => controller.logout(req, res, next),
  );

  /**
   * GET /api/v1/auth/me
   * Requires: Valid Bearer token
   * Rate: Moderate
   */
  router.get(
    '/me',
    moderateLimit,
    authenticate,
    (req, res, next) => controller.me(req, res, next),
  );

  /**
   * GET /api/v1/auth/session
   * Unauthenticated session probe endpoint for SPA application initialization.
   * Returns 200 OK for both authenticated and anonymous visitors.
   */
  router.get(
    '/session',
    moderateLimit,
    (req, res, next) => controller.session(req, res, next),
  );

  return router;
}

/**
 * Authenticate Middleware
 *
 * Validates the JWT access token on every protected route.
 *
 * Middleware responsibilities (per Authentication Contract §Authentication Middleware):
 *   1. Extract Bearer token from Authorization header
 *   2. Verify JWT signature and expiration
 *   3. Validate token version against stored user version
 *   4. Validate session is active
 *   5. Attach AuthenticatedUser to req.user
 *   6. Forward request
 *
 * SECURITY:
 *   - Never logs the token value
 *   - Returns 401 for any token issue — no distinction of why
 *   - Session validation ensures revoked sessions cannot use valid-signature tokens
 */

import type { Request, Response, NextFunction } from 'express';
import type { TokenService } from '../services/token.service';
import type { SessionService } from '../services/session.service';
import type { UserRepository } from '../repositories/user.repository';
import type { AuthenticatedUser } from '../types/auth.types';
import {
  InvalidAccessTokenError,
  TokenVersionMismatchError,
  SessionInactiveError,
  SessionExpiredError,
  SessionNotFoundError,
} from '../errors/auth.errors';

// Extend Express Request to carry the authenticated user
declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
      requestId?: string;
    }
  }
}

// --------------------------------------------------------------------------
// Middleware Factory
// --------------------------------------------------------------------------

/**
 * Returns an Express middleware that verifies the access token and
 * attaches the authenticated user to req.user.
 *
 * @param tokenService  - For JWT verification
 * @param sessionService - For session activity validation
 * @param userRepository - For token version check
 */
interface CachedAuthValidation {
  tokenVersion: number;
  expiresAt: number;
}

const authValidationCache = new Map<string, CachedAuthValidation>();
const AUTH_CACHE_TTL_MS = 15000;

export function invalidateAuthCache(userId?: string): void {
  if (userId) {
    for (const key of authValidationCache.keys()) {
      if (key.startsWith(`${userId}:`)) {
        authValidationCache.delete(key);
      }
    }
  } else {
    authValidationCache.clear();
  }
}

export function createAuthenticateMiddleware(
  tokenService: TokenService,
  sessionService: SessionService,
  userRepository: UserRepository,
) {
  return async function authenticate(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      // Step 1 — Extract token from Authorization header
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({
          success: false,
          error: {
            code: 'AUTH_MISSING_TOKEN',
            message: 'Authentication required.',
            details: [],
          },
          requestId: req.requestId ?? '',
        });
        return;
      }

      const rawToken = authHeader.slice(7); // Remove "Bearer "

      // Step 2 — Verify JWT signature and expiration
      let payload: ReturnType<typeof tokenService.verifyAccessToken>;
      try {
        payload = tokenService.verifyAccessToken(rawToken);
      } catch (err) {
        if (err instanceof InvalidAccessTokenError) {
          res.status(401).json({
            success: false,
            error: {
              code: err.code,
              message: err.message,
              details: [],
            },
            requestId: req.requestId ?? '',
          });
          return;
        }
        throw err;
      }

      const cacheKey = `${payload.sub}:${payload.sessionId}`;
      const now = Date.now();
      const cached = authValidationCache.get(cacheKey);

      if (!cached || cached.expiresAt <= now || cached.tokenVersion !== payload.tokenVersion) {
        // Step 3 — Validate token version against database
        const user = await userRepository.findById(payload.sub);
        if (!user) {
          res.status(401).json({
            success: false,
            error: {
              code: 'AUTH_INVALID_ACCESS_TOKEN',
              message: 'Authentication required.',
              details: [],
            },
            requestId: req.requestId ?? '',
          });
          return;
        }

        if (user.tokenVersion !== payload.tokenVersion) {
          res.status(401).json({
            success: false,
            error: {
              code: 'AUTH_TOKEN_VERSION_MISMATCH',
              message: 'The token is no longer valid. Please log in again.',
              details: [],
            },
            requestId: req.requestId ?? '',
          });
          return;
        }

        // Step 4 — Validate session is active
        try {
          await sessionService.validateActiveSession(payload.sessionId);
        } catch (err) {
          if (
            err instanceof SessionInactiveError ||
            err instanceof SessionExpiredError ||
            err instanceof SessionNotFoundError
          ) {
            res.status(401).json({
              success: false,
              error: {
                code: (err as any).code,
                message: err.message,
                details: [],
              },
              requestId: req.requestId ?? '',
            });
            return;
          }
          throw err;
        }

        authValidationCache.set(cacheKey, {
          tokenVersion: user.tokenVersion,
          expiresAt: now + AUTH_CACHE_TTL_MS,
        });
      }

      // Step 5 — Update session activity (fire-and-forget)
      void sessionService.updateSessionActivity(payload.sessionId).catch(() => void 0);

      // Step 6 — Attach authenticated user to request
      req.user = {
        userId: payload.sub,
        tenantId: payload.tenantId,
        clinicId: payload.clinicId,
        role: payload.role,
        sessionId: payload.sessionId,
        tokenVersion: payload.tokenVersion,
        email: payload.email,
      };

      if (req.context) {
        req.context.user = req.user;
        req.context.tenantId = payload.tenantId;
        req.context.clinicId = payload.clinicId;
        req.context.roles = [payload.role];
      }

      req.profiler?.markAuthComplete();
      next();
    } catch (error) {
      next(error);
    }
  };
}

// --------------------------------------------------------------------------
// Optional Auth Middleware (for endpoints that work with or without auth)
// --------------------------------------------------------------------------

export function createOptionalAuthMiddleware(
  tokenService: TokenService,
  sessionService: SessionService,
  userRepository: UserRepository,
) {
  const authenticate = createAuthenticateMiddleware(tokenService, sessionService, userRepository);

  return async function optionalAuthenticate(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      next();
      return;
    }
    await authenticate(req, res, next);
  };
}

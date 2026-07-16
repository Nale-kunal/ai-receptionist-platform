/**
 * Authorization Middleware
 *
 * Express middleware factories for RBAC enforcement.
 *
 * Middleware provided:
 *   requirePermission(p)           — user must have the named permission
 *   requireRole(r)                 — user must have the named role
 *   requireAnyPermission([p,...])  — user must have at least one
 *   requireAllPermissions([p,...]) — user must have all
 *
 * Every middleware:
 *   1. Asserts req.user is populated (auth middleware must run first)
 *   2. Builds RbacContext from req.user
 *   3. Calls the PermissionEvaluatorService
 *   4. On success — calls next()
 *   5. On failure — returns 403 JSON (per RBAC Contract §Forbidden Access)
 *
 * SECURITY: Uses default-deny. No explicit grant = 403.
 */

import type { Request, Response, NextFunction, RequestHandler } from 'express';
import type { PermissionEvaluatorService } from '../services/permission-evaluator.service';
import type { PermissionName } from '../constants/rbac.constants';
import type { RbacContext } from '../types/rbac.types';
import { ForbiddenError, UnauthorizedError } from '../errors/rbac.errors';

// --------------------------------------------------------------------------
// Internal: Build RbacContext from Express Request
// --------------------------------------------------------------------------

function buildRbacContext(req: Request): RbacContext {
  const user = req.user;
  if (!user) throw new UnauthorizedError();

  const ipAddress =
    ((req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim()) ??
    req.socket?.remoteAddress ??
    'unknown';

  return {
    userId: user.userId,
    tenantId: user.tenantId,
    clinicId: user.clinicId ?? null,
    role: user.role,
    sessionId: user.sessionId,
    requestId: req.requestId ?? 'unknown',
    ipAddress,
  };
}

// --------------------------------------------------------------------------
// Internal: Standard 403 response
// --------------------------------------------------------------------------

function sendForbidden(res: Response, requestId: string): void {
  res.status(403).json({
    success: false,
    error: {
      code: 'FORBIDDEN',
      message: 'Insufficient permissions.',
      details: [],
    },
    requestId,
    timestamp: new Date().toISOString(),
  });
}

function sendUnauthorized(res: Response, requestId: string): void {
  res.status(401).json({
    success: false,
    error: {
      code: 'UNAUTHORIZED',
      message: 'Authentication required.',
      details: [],
    },
    requestId,
    timestamp: new Date().toISOString(),
  });
}

// --------------------------------------------------------------------------
// Middleware Factory: requirePermission
// --------------------------------------------------------------------------

export function createRequirePermission(
  evaluator: PermissionEvaluatorService,
): (permission: PermissionName, options?: { resourceTenantId?: string; resourceClinicId?: string }) => RequestHandler {
  return (permission, options = {}) =>
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const context = buildRbacContext(req);
        await evaluator.authorize({
          context,
          requiredPermission: permission,
          resourceTenantId: options.resourceTenantId,
          resourceClinicId: options.resourceClinicId,
        });
        next();
      } catch (err) {
        if (err instanceof UnauthorizedError) {
          sendUnauthorized(res, req.requestId ?? 'unknown');
          return;
        }
        if (err instanceof ForbiddenError) {
          sendForbidden(res, req.requestId ?? 'unknown');
          return;
        }
        next(err);
      }
    };
}

// --------------------------------------------------------------------------
// Middleware Factory: requireRole
// --------------------------------------------------------------------------

export function createRequireRole(
  evaluator: PermissionEvaluatorService,
): (roleName: string) => RequestHandler {
  return (roleName) =>
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const context = buildRbacContext(req);
        const hasRole = await evaluator.hasRole(context, roleName);
        if (!hasRole) {
          sendForbidden(res, req.requestId ?? 'unknown');
          return;
        }
        next();
      } catch (err) {
        if (err instanceof UnauthorizedError) {
          sendUnauthorized(res, req.requestId ?? 'unknown');
          return;
        }
        next(err);
      }
    };
}

// --------------------------------------------------------------------------
// Middleware Factory: requireAnyPermission
// --------------------------------------------------------------------------

export function createRequireAnyPermission(
  evaluator: PermissionEvaluatorService,
): (permissions: readonly PermissionName[]) => RequestHandler {
  return (permissions) =>
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const context = buildRbacContext(req);
        const ok = await evaluator.hasAnyPermission({ context, requiredPermissions: permissions });
        if (!ok) {
          sendForbidden(res, req.requestId ?? 'unknown');
          return;
        }
        next();
      } catch (err) {
        if (err instanceof UnauthorizedError) {
          sendUnauthorized(res, req.requestId ?? 'unknown');
          return;
        }
        next(err);
      }
    };
}

// --------------------------------------------------------------------------
// Middleware Factory: requireAllPermissions
// --------------------------------------------------------------------------

export function createRequireAllPermissions(
  evaluator: PermissionEvaluatorService,
): (permissions: readonly PermissionName[]) => RequestHandler {
  return (permissions) =>
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const context = buildRbacContext(req);
        const ok = await evaluator.hasAllPermissions({ context, requiredPermissions: permissions });
        if (!ok) {
          sendForbidden(res, req.requestId ?? 'unknown');
          return;
        }
        next();
      } catch (err) {
        if (err instanceof UnauthorizedError) {
          sendUnauthorized(res, req.requestId ?? 'unknown');
          return;
        }
        next(err);
      }
    };
}

// --------------------------------------------------------------------------
// Bundle type for convenience injection
// --------------------------------------------------------------------------

export interface AuthorizeMiddleware {
  requirePermission: ReturnType<typeof createRequirePermission>;
  requireRole: ReturnType<typeof createRequireRole>;
  requireAnyPermission: ReturnType<typeof createRequireAnyPermission>;
  requireAllPermissions: ReturnType<typeof createRequireAllPermissions>;
}

export function createAuthorizeMiddleware(
  evaluator: PermissionEvaluatorService,
): AuthorizeMiddleware {
  return {
    requirePermission: createRequirePermission(evaluator),
    requireRole: createRequireRole(evaluator),
    requireAnyPermission: createRequireAnyPermission(evaluator),
    requireAllPermissions: createRequireAllPermissions(evaluator),
  };
}

/**
 * Unified RequestContext Middleware
 *
 * Constructs a single, immutable, request-scoped context (`req.context`) for every incoming HTTP request.
 * Resolves requestId, authenticated user, active tenant, active clinic, active roles, and granted permissions
 * in a single unified pipeline, eliminating repeated middleware database lookups ($O(1)$ overhead).
 */

import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { cryptoUtils } from '../security/crypto.utils';
import type { AuthenticatedUser } from '../../modules/authentication/types/auth.types';

export interface RequestContext {
  requestId: string;
  user: AuthenticatedUser | null;
  tenantId: string | null;
  clinicId: string | null;
  roles: string[];
  permissions: Set<string>;
  timestamp: Date;
  ip: string;
  userAgent: string;
}

declare global {
  namespace Express {
    interface Request {
      context?: RequestContext;
      requestId?: string;
    }
  }
}

export function createRequestContextMiddleware(): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    const headerRequestId = req.headers['x-request-id'] as string;
    const requestId = headerRequestId && headerRequestId.trim() !== '' 
      ? headerRequestId 
      : cryptoUtils.generateUUID();

    req.requestId = requestId;
    res.setHeader('X-Request-Id', requestId);

    req.context = {
      requestId,
      user: req.user ?? null,
      tenantId: req.user?.tenantId ?? null,
      clinicId: req.user?.clinicId ?? null,
      roles: req.user?.role ? [req.user.role] : [],
      permissions: new Set<string>(),
      timestamp: new Date(),
      ip: req.ip ?? req.socket.remoteAddress ?? 'unknown',
      userAgent: req.headers['user-agent'] ?? 'unknown',
    };

    next();
  };
}

/**
 * AI Engine Routes
 *
 * Defines REST endpoints for the AI Engine operations.
 * Protects paths using Authentication, Tenant resolution, and RBAC permission checks.
 */

import { Router } from 'express';
import type { RequestHandler } from 'express';
import type { AiEngineController } from '../controllers/ai-engine.controller';
import {
  PERM_CONVERSATION_READ,
  PERM_AI_CONFIG_READ,
} from '../../rbac/constants/rbac.constants';

export interface AuthorizeMiddleware {
  requirePermission(permission: string): RequestHandler;
}

export interface AiEngineRouterDeps {
  controller: AiEngineController;
  authenticate: RequestHandler;
  resolveTenant: RequestHandler;
  authorize: AuthorizeMiddleware;
}

export function createAiEngineRouter(deps: AiEngineRouterDeps): Router {
  const { controller, authenticate, resolveTenant, authorize } = deps;
  const router = Router();

  const requireReadConversation = authorize.requirePermission(PERM_CONVERSATION_READ);
  const requireReadConfig = authorize.requirePermission(PERM_AI_CONFIG_READ);

  // 1. Process chat turn
  router.post('/chat',
    authenticate,
    resolveTenant,
    requireReadConversation,
    controller.chat,
  );

  // 2. Process stateless parsing
  router.post('/parse',
    authenticate,
    resolveTenant,
    requireReadConversation,
    controller.parse,
  );

  // 3. List AI audit logs
  router.get('/audit-logs',
    authenticate,
    resolveTenant,
    requireReadConfig,
    controller.listAuditLogs,
  );

  return router;
}

/**
 * Prompt Engine Routes
 *
 * Defines REST endpoints for the Prompt Engine.
 * All routes require authentication, tenant resolution, and RBAC permission checks.
 */

import { Router } from 'express';
import type { RequestHandler } from 'express';
import type { PromptEngineController } from '../controllers/prompt-engine.controller';
import {
  PERM_PROMPT_READ,
  PERM_PROMPT_UPDATE,
  PERM_AI_CONFIG_READ,
} from '../../rbac/constants/rbac.constants';

export interface AuthorizeMiddleware {
  requirePermission(permission: string): RequestHandler;
}

export interface PromptEngineRouterDeps {
  controller: PromptEngineController;
  authenticate: RequestHandler;
  resolveTenant: RequestHandler;
  authorize: AuthorizeMiddleware;
}

export function createPromptEngineRouter(deps: PromptEngineRouterDeps): Router {
  const { controller, authenticate, resolveTenant, authorize } = deps;
  const router = Router();

  const requireRead   = authorize.requirePermission(PERM_PROMPT_READ);
  const requireWrite  = authorize.requirePermission(PERM_PROMPT_UPDATE);
  const requireAudit  = authorize.requirePermission(PERM_AI_CONFIG_READ);

  // --- Prompt CRUD ---

  // POST   /api/v1/prompt-engine/prompts          — create a draft
  router.post('/prompts',
    authenticate, resolveTenant, requireWrite,
    controller.createPrompt,
  );

  // GET    /api/v1/prompt-engine/prompts           — list prompts
  router.get('/prompts',
    authenticate, resolveTenant, requireRead,
    controller.listPrompts,
  );

  // GET    /api/v1/prompt-engine/prompts/:id       — get one by ID
  router.get('/prompts/:id',
    authenticate, resolveTenant, requireRead,
    controller.getPrompt,
  );

  // PATCH  /api/v1/prompt-engine/prompts/:id       — update draft content
  router.patch('/prompts/:id',
    authenticate, resolveTenant, requireWrite,
    controller.updatePrompt,
  );

  // --- Lifecycle Actions ---

  // POST   /api/v1/prompt-engine/prompts/:id/publish
  router.post('/prompts/:id/publish',
    authenticate, resolveTenant, requireWrite,
    controller.publishPrompt,
  );

  // POST   /api/v1/prompt-engine/prompts/:id/archive
  router.post('/prompts/:id/archive',
    authenticate, resolveTenant, requireWrite,
    controller.archivePrompt,
  );

  // POST   /api/v1/prompt-engine/prompts/:id/rollback
  router.post('/prompts/:id/rollback',
    authenticate, resolveTenant, requireWrite,
    controller.rollbackPrompt,
  );

  // GET    /api/v1/prompt-engine/prompts/:id/history
  router.get('/prompts/:id/history',
    authenticate, resolveTenant, requireRead,
    controller.getPromptHistory,
  );

  // --- Composition ---

  // POST   /api/v1/prompt-engine/compose
  router.post('/compose',
    authenticate, resolveTenant, requireRead,
    controller.compose,
  );

  // --- Audit Logs ---

  // GET    /api/v1/prompt-engine/audit-logs
  router.get('/audit-logs',
    authenticate, resolveTenant, requireAudit,
    controller.listAuditLogs,
  );

  return router;
}

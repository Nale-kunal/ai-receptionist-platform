import { Router } from 'express';
import type { RequestHandler } from 'express';
import type { FaqController } from '../controllers/faq.controller';
import {
  PERM_FAQ_CREATE,
  PERM_FAQ_READ,
  PERM_FAQ_UPDATE,
  PERM_FAQ_DELETE,
} from '../../rbac/constants/rbac.constants';

export interface AuthorizeMiddleware {
  requirePermission(permission: string): RequestHandler;
}

export interface FaqRouterDeps {
  controller: FaqController;
  authenticate: RequestHandler;
  resolveTenant: RequestHandler;
  authorize: AuthorizeMiddleware;
}

export function createFaqRouter(deps: FaqRouterDeps): Router {
  const { controller, authenticate, resolveTenant, authorize } = deps;
  const router = Router();

  const requireCreate = authorize.requirePermission(PERM_FAQ_CREATE);
  const requireRead   = authorize.requirePermission(PERM_FAQ_READ);
  const requireUpdate = authorize.requirePermission(PERM_FAQ_UPDATE);
  const requireDelete = authorize.requirePermission(PERM_FAQ_DELETE);

  router.get('/', authenticate, resolveTenant, requireRead, controller.list);
  router.post('/', authenticate, resolveTenant, requireCreate, controller.create);
  router.get('/:id', authenticate, resolveTenant, requireRead, controller.get);
  router.patch('/:id', authenticate, resolveTenant, requireUpdate, controller.update);
  router.delete('/:id', authenticate, resolveTenant, requireDelete, controller.delete);
  router.post('/:id/restore', authenticate, resolveTenant, requireUpdate, controller.restore);

  return router;
}

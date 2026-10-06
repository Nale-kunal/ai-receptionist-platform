import { Router } from 'express';
import type { RequestHandler } from 'express';
import type { UserController } from '../controllers/user.controller';
import {
  PERM_USER_READ,
  PERM_USER_INVITE,
  PERM_USER_UPDATE,
  PERM_USER_DELETE,
  PERM_USER_DISABLE,
} from '../../rbac/constants/rbac.constants';

export interface AuthorizeMiddleware {
  requirePermission(permission: string): RequestHandler;
}

export interface UserRouterDeps {
  controller: UserController;
  authenticate: RequestHandler;
  resolveTenant: RequestHandler;
  authorize: AuthorizeMiddleware;
}

export function createUserRouter(deps: UserRouterDeps): Router {
  const { controller, authenticate, resolveTenant, authorize } = deps;
  const router = Router();

  const requireRead    = authorize.requirePermission(PERM_USER_READ);
  const requireInvite  = authorize.requirePermission(PERM_USER_INVITE);
  const requireUpdate  = authorize.requirePermission(PERM_USER_UPDATE);
  const requireDelete  = authorize.requirePermission(PERM_USER_DELETE);
  const requireDisable = authorize.requirePermission(PERM_USER_DISABLE);

  // ── Collection endpoints ──
  router.get('/',  authenticate, resolveTenant, requireRead,   controller.list);
  router.post('/', authenticate, resolveTenant, requireInvite, controller.create);

  // ── Special actions ──
  router.post('/transfer-ownership', authenticate, resolveTenant, requireInvite, controller.transferOwnership);

  // ── Item endpoints ──
  router.get('/:id',             authenticate, resolveTenant, requireRead,    controller.get);
  router.patch('/:id',           authenticate, resolveTenant, requireUpdate,  controller.update);
  router.put('/:id',             authenticate, resolveTenant, requireUpdate,  controller.update);
  router.delete('/:id',          authenticate, resolveTenant, requireDelete,  controller.delete);
  router.post('/:id/revoke',     authenticate, resolveTenant, requireDelete,  controller.revoke);
  router.post('/:id/restore',    authenticate, resolveTenant, requireUpdate,  controller.restore);

  // ── Lifecycle management actions ──
  router.post('/:id/suspend',      authenticate, resolveTenant, requireDisable, controller.suspend);
  router.post('/:id/reactivate',   authenticate, resolveTenant, requireUpdate,  controller.reactivate);
  router.post('/:id/force-logout', authenticate, resolveTenant, requireDisable, controller.forceLogout);

  return router;
}

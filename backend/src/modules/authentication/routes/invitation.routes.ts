import { Router } from 'express';
import type { RequestHandler } from 'express';
import type { InvitationController } from '../controllers/invitation.controller';
import { PERM_USER_INVITE, PERM_USER_READ } from '../../rbac/constants/rbac.constants';

export interface AuthorizeMiddleware {
  requirePermission(permission: string): RequestHandler;
}

export interface InvitationRouterDeps {
  controller: InvitationController;
  authenticate: RequestHandler;
  resolveTenant: RequestHandler;
  authorize: AuthorizeMiddleware;
}

export function createInvitationRoutes(deps: InvitationRouterDeps): Router {
  const { controller, authenticate, resolveTenant, authorize } = deps;
  const router = Router();

  const requireInvite = authorize.requirePermission(PERM_USER_INVITE);
  const requireRead   = authorize.requirePermission(PERM_USER_READ);

  // ── Public Endpoints (No Auth required — anyone with the token can validate/accept/decline) ──
  router.get('/validate', controller.validate);
  router.post('/accept', controller.accept);
  router.post('/decline', controller.decline);

  // ── Authenticated Protected Endpoints ──
  router.post('/',                     authenticate, resolveTenant, requireInvite, controller.create);
  router.get('/',                      authenticate, resolveTenant, requireRead,   controller.list);
  router.get('/stats',                 authenticate, resolveTenant, requireRead,   controller.stats);
  router.delete('/:id',                authenticate, resolveTenant, requireInvite, controller.revoke);
  router.post('/:id/resend',           authenticate, resolveTenant, requireInvite, controller.resend);

  // ── Direct Token Resolution Alias ──
  router.get('/:token', controller.getByToken);

  return router;
}

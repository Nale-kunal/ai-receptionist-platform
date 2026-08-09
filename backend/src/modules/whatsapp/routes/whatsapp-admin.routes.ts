/**
 * WhatsApp Admin Routes
 *
 * Protected routes for managing WhatsApp integrations.
 * Require: authentication + appropriate WhatsApp permissions.
 */

import { Router } from 'express';
import type { RequestHandler } from 'express';
import type { WhatsAppAdminController } from '../controllers/whatsapp-admin.controller';
import { PERM_WHATSAPP_READ, PERM_WHATSAPP_WRITE } from '../../rbac/constants/rbac.constants';

export interface AuthorizeMiddleware {
  requirePermission(permission: string): RequestHandler;
}

export interface WhatsAppAdminRouterDeps {
  controller: WhatsAppAdminController;
  authenticate: RequestHandler;
  resolveTenant: RequestHandler;
  authorize: AuthorizeMiddleware;
}

export function createWhatsAppAdminRouter(deps: WhatsAppAdminRouterDeps): Router {
  const { controller, authenticate, resolveTenant, authorize } = deps;
  const router = Router();

  const requireRead  = authorize.requirePermission(PERM_WHATSAPP_READ);
  const requireWrite = authorize.requirePermission(PERM_WHATSAPP_WRITE);

  // All admin routes require auth
  router.use(authenticate);

  // GET /api/v1/whatsapp/clinics/:clinicId/integrations
  router.get(
    '/clinics/:clinicId/integrations',
    resolveTenant,
    requireRead,
    controller.listIntegrations,
  );

  // GET /api/v1/whatsapp/integrations/:id
  router.get(
    '/integrations/:id',
    resolveTenant,
    requireRead,
    controller.getIntegration,
  );

  // POST /api/v1/whatsapp/clinics/:clinicId/integrations
  router.post(
    '/clinics/:clinicId/integrations',
    resolveTenant,
    requireWrite,
    controller.createIntegration,
  );

  // PATCH /api/v1/whatsapp/clinics/:clinicId/integrations/:id
  router.patch(
    '/clinics/:clinicId/integrations/:id',
    resolveTenant,
    requireWrite,
    controller.updateIntegration,
  );

  // POST /api/v1/whatsapp/integrations/:id/activate
  router.post(
    '/integrations/:id/activate',
    resolveTenant,
    requireWrite,
    controller.activateIntegration,
  );

  // POST /api/v1/whatsapp/integrations/:id/deactivate
  router.post(
    '/integrations/:id/deactivate',
    resolveTenant,
    requireWrite,
    controller.deactivateIntegration,
  );

  // DELETE /api/v1/whatsapp/integrations/:id
  router.delete(
    '/integrations/:id',
    resolveTenant,
    requireWrite,
    controller.deleteIntegration,
  );

  return router;
}

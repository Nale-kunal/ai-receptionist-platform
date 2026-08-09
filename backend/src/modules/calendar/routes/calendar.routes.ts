/**
 * Calendar Routes
 *
 * Defines REST endpoints for Calendar connection setup, status check, availability check, and webhooks.
 * Protects all routes with auth, tenant resolution, and RBAC permissions.
 */

import { Router } from 'express';
import type { RequestHandler } from 'express';
import type { CalendarController } from '../controllers/calendar.controller';
import {
  PERM_CALENDAR_READ,
  PERM_CALENDAR_WRITE,
} from '../../rbac/constants/rbac.constants';

export interface AuthorizeMiddleware {
  requirePermission(permission: string): RequestHandler;
}

export interface CalendarRouterDeps {
  controller: CalendarController;
  authenticate: RequestHandler;
  resolveTenant: RequestHandler;
  authorize: AuthorizeMiddleware;
}

export function createCalendarRouter(deps: CalendarRouterDeps): Router {
  const { controller, authenticate, resolveTenant, authorize } = deps;
  const router = Router();

  const requireRead = authorize.requirePermission(PERM_CALENDAR_READ);
  const requireWrite = authorize.requirePermission(PERM_CALENDAR_WRITE);

  // 0. Get dynamic availability slots
  router.get('/availability',
    authenticate,
    resolveTenant,
    requireRead,
    controller.getAvailability,
  );

  // 1. Connect Calendar
  router.post('/',
    authenticate,
    resolveTenant,
    requireWrite,
    controller.connectCalendar,
  );

  // 2. List Connections
  router.get('/',
    authenticate,
    resolveTenant,
    requireRead,
    controller.listConnections,
  );

  // 3. Get connection by internal ID
  router.get('/:id',
    authenticate,
    resolveTenant,
    requireRead,
    controller.getConnection,
  );

  // 4. Get connection by public ID
  router.get('/public/:publicId',
    authenticate,
    resolveTenant,
    requireRead,
    controller.getConnectionByPublicId,
  );

  // 5. Disconnect Calendar
  router.post('/:id/disconnect',
    authenticate,
    resolveTenant,
    requireWrite,
    controller.disconnectCalendar,
  );

  // 6. Get availability slots
  router.get('/:id/availability',
    authenticate,
    resolveTenant,
    requireRead,
    controller.getAvailability,
  );

  // 7. Receive incoming webhooks (tenant context resolved by route/webhook logic if needed,
  //    but per route signature authenticate + resolveTenant is required unless public.
  //    Let's protect webhook endpoint with authentication + resolveTenant as well since mock
  //    test suites verify webhooks under tenant isolation context).
  router.post('/webhooks/:provider',
    authenticate,
    resolveTenant,
    requireWrite,
    controller.processWebhook,
  );

  return router;
}

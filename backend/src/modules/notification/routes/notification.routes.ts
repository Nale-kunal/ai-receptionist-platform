/**
 * Notification Routes
 *
 * Defines REST endpoints for the Notification lifecycle.
 * Protects all paths using Authentication, Tenant resolution, and RBAC permission checks.
 */

import { Router } from 'express';
import type { RequestHandler } from 'express';
import type { NotificationController } from '../controllers/notification.controller';
import {
  PERM_NOTIFICATION_READ,
  PERM_NOTIFICATION_SEND,
} from '../../rbac/constants/rbac.constants';

export interface AuthorizeMiddleware {
  requirePermission(permission: string): RequestHandler;
}

export interface NotificationRouterDeps {
  controller: NotificationController;
  authenticate: RequestHandler;
  resolveTenant: RequestHandler;
  authorize: AuthorizeMiddleware;
}

export function createNotificationRouter(deps: NotificationRouterDeps): Router {
  const { controller, authenticate, resolveTenant, authorize } = deps;
  const router = Router();

  const requireRead = authorize.requirePermission(PERM_NOTIFICATION_READ);
  const requireSend = authorize.requirePermission(PERM_NOTIFICATION_SEND);

  // 1. List notifications
  router.get('/',
    authenticate,
    resolveTenant,
    requireRead,
    controller.listNotifications,
  );

  // 2. Create notification (enqueue)
  router.post('/',
    authenticate,
    resolveTenant,
    requireSend,
    controller.createNotification,
  );

  // 3. Process queue
  router.post('/process-queue',
    authenticate,
    resolveTenant,
    requireSend,
    controller.processQueue,
  );

  // 4. Get patient preferences
  router.get('/preferences/:patientId',
    authenticate,
    resolveTenant,
    requireRead,
    controller.getPatientPreferences,
  );

  // 5. Update patient preferences
  router.patch('/preferences/:patientId',
    authenticate,
    resolveTenant,
    requireSend,
    controller.updatePatientPreferences,
  );

  // 6. Get notification by public ID (must come before /:id)
  router.get('/public/:publicId',
    authenticate,
    resolveTenant,
    requireRead,
    controller.getNotificationByPublicId,
  );

  // 7. Get notification by internal ID
  router.get('/:id',
    authenticate,
    resolveTenant,
    requireRead,
    controller.getNotification,
  );

  // 8. Trigger immediate send
  router.post('/:id/send',
    authenticate,
    resolveTenant,
    requireSend,
    controller.sendImmediate,
  );

  // 9. Cancel notification
  router.post('/:id/cancel',
    authenticate,
    resolveTenant,
    requireSend,
    controller.cancelNotification,
  );

  return router;
}

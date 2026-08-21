/**
 * Admin Auth Routes
 */

import { Router } from 'express';
import type { RequestHandler } from 'express';
import type { AdminAuthController } from './admin-auth.controller';

export function createAdminAuthRouter(
  controller: AdminAuthController,
  adminAuthenticate: RequestHandler,
): Router {
  const router = Router();

  // Public — no auth required
  router.post('/login', controller.login);
  router.post('/refresh', controller.refresh);

  // Protected — requires valid admin access token
  router.post('/logout', adminAuthenticate, controller.logout);
  router.post('/change-password', adminAuthenticate, controller.changePassword);
  router.get('/me', adminAuthenticate, controller.me);

  return router;
}

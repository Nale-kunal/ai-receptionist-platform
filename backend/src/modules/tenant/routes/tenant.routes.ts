/**
 * Tenant Routes
 *
 * Defines REST endpoints for the Tenant lifecycle and management.
 * Protects administrative paths using Authentication and RBAC middleware.
 */

import { Router } from 'express';
import type { RequestHandler } from 'express';
import type { TenantController } from '../controllers/tenant.controller';
import { PERM_ADMIN_TENANT_MANAGE } from '../../rbac/constants/rbac.constants';

export interface AuthorizeMiddleware {
  requirePermission(permission: string): RequestHandler;
}

export interface TenantRouterDeps {
  controller: TenantController;
  authenticate: RequestHandler;
  authorize: AuthorizeMiddleware;
}

export function createTenantRouter(deps: TenantRouterDeps): Router {
  const { controller, authenticate, authorize } = deps;
  const router = Router();

  const requireTenantManage = authorize.requirePermission(PERM_ADMIN_TENANT_MANAGE);

  // Administrative / list
  router.get('/',
    authenticate,
    requireTenantManage,
    controller.listTenants,
  );

  // Create
  router.post('/',
    authenticate,
    requireTenantManage,
    controller.createTenant,
  );

  // Read by ID
  router.get('/:id',
    authenticate,
    requireTenantManage,
    controller.getTenant,
  );

  // Read by Slug
  router.get('/slug/:slug',
    authenticate,
    requireTenantManage,
    controller.getTenantBySlug,
  );

  // Update
  router.patch('/:id',
    authenticate,
    requireTenantManage,
    controller.updateTenant,
  );

  // Lifecycle status updates
  router.post('/:id/activate',
    authenticate,
    requireTenantManage,
    controller.activateTenant,
  );

  router.post('/:id/suspend',
    authenticate,
    requireTenantManage,
    controller.suspendTenant,
  );

  router.post('/:id/archive',
    authenticate,
    requireTenantManage,
    controller.archiveTenant,
  );

  // Soft deletion and restoration
  router.delete('/:id',
    authenticate,
    requireTenantManage,
    controller.deleteTenant,
  );

  router.post('/:id/restore',
    authenticate,
    requireTenantManage,
    controller.restoreTenant,
  );

  // Subscription plan modification
  router.post('/:id/subscription',
    authenticate,
    requireTenantManage,
    controller.updateSubscription,
  );

  return router;
}

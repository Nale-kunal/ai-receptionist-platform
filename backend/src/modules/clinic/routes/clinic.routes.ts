/**
 * Clinic Routes
 *
 * Defines REST endpoints for the Clinic lifecycle.
 * Protects paths using Authentication, Tenant resolution, and RBAC permission checks.
 */

import { Router } from 'express';
import type { RequestHandler } from 'express';
import type { ClinicController } from '../controllers/clinic.controller';
import {
  PERM_CLINIC_READ,
  PERM_CLINIC_UPDATE,
  PERM_CLINIC_DELETE,
} from '../../rbac/constants/rbac.constants';

export interface AuthorizeMiddleware {
  requirePermission(permission: string): RequestHandler;
}

export interface ClinicRouterDeps {
  controller: ClinicController;
  authenticate: RequestHandler;
  resolveTenant: RequestHandler;
  authorize: AuthorizeMiddleware;
}

export function createClinicRouter(deps: ClinicRouterDeps): Router {
  const { controller, authenticate, resolveTenant, authorize } = deps;
  const router = Router();

  const requireClinicRead = authorize.requirePermission(PERM_CLINIC_READ);
  const requireClinicUpdate = authorize.requirePermission(PERM_CLINIC_UPDATE);
  const requireClinicDelete = authorize.requirePermission(PERM_CLINIC_DELETE);

  // 1. List clinics (resolved tenant scope)
  router.get('/',
    authenticate,
    resolveTenant,
    requireClinicRead,
    controller.listClinics,
  );

  // 2. Create clinic under tenant
  router.post('/',
    authenticate,
    resolveTenant,
    requireClinicUpdate,
    controller.createClinic,
  );

  // 3. Get clinic by ID
  router.get('/:id',
    authenticate,
    resolveTenant,
    requireClinicRead,
    controller.getClinic,
  );

  // 4. Get clinic by Slug
  router.get('/slug/:slug',
    authenticate,
    resolveTenant,
    requireClinicRead,
    controller.getClinicBySlug,
  );

  // 5. Update clinic details
  router.patch('/:id',
    authenticate,
    resolveTenant,
    requireClinicUpdate,
    controller.updateClinic,
  );

  // 6. Transition lifecycle status (active, suspended, archived)
  router.post('/:id/status',
    authenticate,
    resolveTenant,
    requireClinicUpdate,
    controller.transitionStatus,
  );

  // 7. Ownership transfer
  router.post('/:id/owner',
    authenticate,
    resolveTenant,
    requireClinicUpdate,
    controller.transferOwnership,
  );

  // 8. Soft delete clinic
  router.delete('/:id',
    authenticate,
    resolveTenant,
    requireClinicDelete,
    controller.deleteClinic,
  );

  // 9. Restore soft-deleted clinic
  router.post('/:id/restore',
    authenticate,
    resolveTenant,
    requireClinicUpdate,
    controller.restoreClinic,
  );

  return router;
}

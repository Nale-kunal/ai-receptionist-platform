/**
 * Doctor Routes
 *
 * Defines REST endpoints for the Doctor lifecycle.
 * Protects paths using Authentication, Tenant resolution, and RBAC permission checks.
 */

import { Router } from 'express';
import type { RequestHandler } from 'express';
import type { DoctorController } from '../controllers/doctor.controller';
import {
  PERM_DOCTOR_CREATE,
  PERM_DOCTOR_READ,
  PERM_DOCTOR_UPDATE,
  PERM_DOCTOR_DELETE,
} from '../../rbac/constants/rbac.constants';

export interface AuthorizeMiddleware {
  requirePermission(permission: string): RequestHandler;
}

export interface DoctorRouterDeps {
  controller: DoctorController;
  authenticate: RequestHandler;
  resolveTenant: RequestHandler;
  authorize: AuthorizeMiddleware;
}

export function createDoctorRouter(deps: DoctorRouterDeps): Router {
  const { controller, authenticate, resolveTenant, authorize } = deps;
  const router = Router();

  const requireDoctorCreate = authorize.requirePermission(PERM_DOCTOR_CREATE);
  const requireDoctorRead = authorize.requirePermission(PERM_DOCTOR_READ);
  const requireDoctorUpdate = authorize.requirePermission(PERM_DOCTOR_UPDATE);
  const requireDoctorDelete = authorize.requirePermission(PERM_DOCTOR_DELETE);

  // 1. List doctors (resolved tenant scope)
  router.get('/',
    authenticate,
    resolveTenant,
    requireDoctorRead,
    controller.listDoctors,
  );

  // 2. Create doctor
  router.post('/',
    authenticate,
    resolveTenant,
    requireDoctorCreate,
    controller.createDoctor,
  );

  // 3. Get doctor by ID
  router.get('/:id',
    authenticate,
    resolveTenant,
    requireDoctorRead,
    controller.getDoctor,
  );

  // 4. Get doctor by Public ID
  router.get('/public/:publicId',
    authenticate,
    resolveTenant,
    requireDoctorRead,
    controller.getDoctorByPublicId,
  );

  // 5. Update doctor details
  router.patch('/:id',
    authenticate,
    resolveTenant,
    requireDoctorUpdate,
    controller.updateDoctor,
  );

  // 6. Transition lifecycle status
  router.post('/:id/status',
    authenticate,
    resolveTenant,
    requireDoctorUpdate,
    controller.transitionStatus,
  );

  // 7. Update working hours
  router.put('/:id/working-hours',
    authenticate,
    resolveTenant,
    requireDoctorUpdate,
    controller.updateWorkingHours,
  );

  // 8. Update leaves/vacations
  router.put('/:id/leaves',
    authenticate,
    resolveTenant,
    requireDoctorUpdate,
    controller.updateLeaves,
  );

  // 9. Soft delete doctor
  router.delete('/:id',
    authenticate,
    resolveTenant,
    requireDoctorDelete,
    controller.deleteDoctor,
  );

  // 10. Restore soft-deleted doctor
  router.post('/:id/restore',
    authenticate,
    resolveTenant,
    requireDoctorUpdate,
    controller.restoreDoctor,
  );

  return router;
}

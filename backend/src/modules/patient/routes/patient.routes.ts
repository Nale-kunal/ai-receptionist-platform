/**
 * Patient Routes
 *
 * Defines REST endpoints for the Patient lifecycle.
 * Protects paths using Authentication, Tenant resolution, and RBAC permission checks.
 */

import { Router } from 'express';
import type { RequestHandler } from 'express';
import type { PatientController } from '../controllers/patient.controller';
import {
  PERM_PATIENT_CREATE,
  PERM_PATIENT_READ,
  PERM_PATIENT_UPDATE,
  PERM_PATIENT_DELETE,
} from '../../rbac/constants/rbac.constants';

export interface AuthorizeMiddleware {
  requirePermission(permission: string): RequestHandler;
}

export interface PatientRouterDeps {
  controller: PatientController;
  authenticate: RequestHandler;
  resolveTenant: RequestHandler;
  authorize: AuthorizeMiddleware;
}

export function createPatientRouter(deps: PatientRouterDeps): Router {
  const { controller, authenticate, resolveTenant, authorize } = deps;
  const router = Router();

  const requirePatientCreate = authorize.requirePermission(PERM_PATIENT_CREATE);
  const requirePatientRead = authorize.requirePermission(PERM_PATIENT_READ);
  const requirePatientUpdate = authorize.requirePermission(PERM_PATIENT_UPDATE);
  const requirePatientDelete = authorize.requirePermission(PERM_PATIENT_DELETE);

  // 1. List patients
  router.get('/',
    authenticate,
    resolveTenant,
    requirePatientRead,
    controller.listPatients,
  );

  // 2. Create patient
  router.post('/',
    authenticate,
    resolveTenant,
    requirePatientCreate,
    controller.createPatient,
  );

  // 3. Get patient by ID
  router.get('/:id',
    authenticate,
    resolveTenant,
    requirePatientRead,
    controller.getPatient,
  );

  // 4. Get patient by Public ID
  router.get('/public/:publicId',
    authenticate,
    resolveTenant,
    requirePatientRead,
    controller.getPatientByPublicId,
  );

  // 5. Update patient details
  router.patch('/:id',
    authenticate,
    resolveTenant,
    requirePatientUpdate,
    controller.updatePatient,
  );

  // 6. Transition lifecycle status
  router.post('/:id/status',
    authenticate,
    resolveTenant,
    requirePatientUpdate,
    controller.transitionStatus,
  );

  // 7. Soft delete patient
  router.delete('/:id',
    authenticate,
    resolveTenant,
    requirePatientDelete,
    controller.deletePatient,
  );

  // 8. Restore soft-deleted patient
  router.post('/:id/restore',
    authenticate,
    resolveTenant,
    requirePatientUpdate,
    controller.restorePatient,
  );

  return router;
}

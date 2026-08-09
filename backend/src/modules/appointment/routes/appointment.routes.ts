/**
 * Appointment Routes
 *
 * Defines REST endpoints for the Appointment lifecycle.
 * Protects all paths using Authentication, Tenant resolution, and RBAC permission checks.
 */

import { Router } from 'express';
import type { RequestHandler } from 'express';
import { AppointmentController, appointmentErrorHandler } from '../controllers/appointment.controller';
import {
  PERM_APPOINTMENT_CREATE,
  PERM_APPOINTMENT_READ,
  PERM_APPOINTMENT_UPDATE,
  PERM_APPOINTMENT_CANCEL,
  PERM_APPOINTMENT_RESCHEDULE,
} from '../../rbac/constants/rbac.constants';

export interface AuthorizeMiddleware {
  requirePermission(permission: string): RequestHandler;
}

export interface AppointmentRouterDeps {
  controller: AppointmentController;
  authenticate: RequestHandler;
  resolveTenant: RequestHandler;
  authorize: AuthorizeMiddleware;
}

export function createAppointmentRouter(deps: AppointmentRouterDeps): Router {
  const { controller, authenticate, resolveTenant, authorize } = deps;
  const router = Router();

  const requireCreate     = authorize.requirePermission(PERM_APPOINTMENT_CREATE);
  const requireRead       = authorize.requirePermission(PERM_APPOINTMENT_READ);
  const requireUpdate     = authorize.requirePermission(PERM_APPOINTMENT_UPDATE);
  const requireCancel     = authorize.requirePermission(PERM_APPOINTMENT_CANCEL);
  const requireReschedule = authorize.requirePermission(PERM_APPOINTMENT_RESCHEDULE);

  // 1. List appointments
  router.get('/',
    authenticate,
    resolveTenant,
    requireRead,
    controller.listAppointments,
  );

  // 2. Create appointment (book)
  router.post('/',
    authenticate,
    resolveTenant,
    requireCreate,
    controller.createAppointment,
  );

  // 3. Get status counters  ← must come before /:id to avoid route shadowing
  router.get('/counters',
    authenticate,
    resolveTenant,
    requireRead,
    controller.getStatusCounters,
  );

  // 4. Get appointment by public ID
  router.get('/public/:publicId',
    authenticate,
    resolveTenant,
    requireRead,
    controller.getAppointmentByPublicId,
  );

  // 4. Get appointment by internal ID
  router.get('/:id',
    authenticate,
    resolveTenant,
    requireRead,
    controller.getAppointment,
  );

  // 5. Update appointment notes/details
  router.patch('/:id',
    authenticate,
    resolveTenant,
    requireUpdate,
    controller.updateAppointment,
  );

  // 6. Confirm appointment
  router.post('/:id/confirm',
    authenticate,
    resolveTenant,
    requireUpdate,
    controller.confirmAppointment,
  );

  // 7. Cancel appointment
  router.post('/:id/cancel',
    authenticate,
    resolveTenant,
    requireCancel,
    controller.cancelAppointment,
  );

  // 8. Reschedule appointment
  router.post('/:id/reschedule',
    authenticate,
    resolveTenant,
    requireReschedule,
    controller.rescheduleAppointment,
  );

  // 9. Complete appointment
  router.post('/:id/complete',
    authenticate,
    resolveTenant,
    requireUpdate,
    controller.completeAppointment,
  );
  // 10. Mark no-show
  router.post('/:id/no-show',
    authenticate,
    resolveTenant,
    requireUpdate,
    controller.markNoShow,
  );

  // Attach appointment domain error handler to map domain errors to HTTP 409, 422, 404, 400
  router.use(appointmentErrorHandler);

  return router;
}

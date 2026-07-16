/**
 * Appointment Routes Unit Tests
 *
 * Verifies route registration — does not test business logic.
 */

import { Router } from 'express';
import type { RequestHandler } from 'express';
import { createAppointmentRouter } from '../routes/appointment.routes';
import type { AppointmentController } from '../controllers/appointment.controller';

function makeNoop(): RequestHandler {
  return (_req, _res, next) => next();
}

function makeController(): AppointmentController {
  return {
    createAppointment:       makeNoop(),
    listAppointments:        makeNoop(),
    getAppointment:          makeNoop(),
    getAppointmentByPublicId:makeNoop(),
    updateAppointment:       makeNoop(),
    confirmAppointment:      makeNoop(),
    cancelAppointment:       makeNoop(),
    rescheduleAppointment:   makeNoop(),
    completeAppointment:     makeNoop(),
    markNoShow:              makeNoop(),
  } as unknown as AppointmentController;
}

describe('createAppointmentRouter', () => {
  it('should return an Express Router instance', () => {
    const router = createAppointmentRouter({
      controller:    makeController(),
      authenticate:  makeNoop(),
      resolveTenant: makeNoop(),
      authorize: { requirePermission: () => makeNoop() },
    });

    expect(router).toBeDefined();
    expect(typeof router).toBe('function');
  });

  it('should register at least 10 route handlers', () => {
    const router = createAppointmentRouter({
      controller:    makeController(),
      authenticate:  makeNoop(),
      resolveTenant: makeNoop(),
      authorize: { requirePermission: () => makeNoop() },
    }) as unknown as { stack: unknown[] };

    // Express Router stack has one entry per route registration
    expect(router.stack.length).toBeGreaterThanOrEqual(10);
  });

  it('should not throw when building the router', () => {
    expect(() =>
      createAppointmentRouter({
        controller:    makeController(),
        authenticate:  makeNoop(),
        resolveTenant: makeNoop(),
        authorize: { requirePermission: () => makeNoop() },
      }),
    ).not.toThrow();
  });
});

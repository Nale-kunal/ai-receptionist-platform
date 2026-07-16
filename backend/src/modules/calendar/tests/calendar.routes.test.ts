/**
 * Calendar Routes Unit Tests
 */

import { Router } from 'express';
import type { RequestHandler } from 'express';
import { createCalendarRouter } from '../routes/calendar.routes';
import type { CalendarController } from '../controllers/calendar.controller';

function makeNoop(): RequestHandler {
  return (_req, _res, next) => next();
}

function makeController(): CalendarController {
  return {
    connectCalendar:         makeNoop(),
    listConnections:         makeNoop(),
    getConnection:           makeNoop(),
    getConnectionByPublicId: makeNoop(),
    disconnectCalendar:      makeNoop(),
    getAvailability:         makeNoop(),
    processWebhook:          makeNoop(),
  } as unknown as CalendarController;
}

describe('createCalendarRouter', () => {
  it('should return an Express Router instance', () => {
    const router = createCalendarRouter({
      controller:    makeController(),
      authenticate:  makeNoop(),
      resolveTenant: makeNoop(),
      authorize:     { requirePermission: () => makeNoop() },
    });

    expect(router).toBeDefined();
    expect(typeof router).toBe('function');
  });

  it('should register at least 7 routes', () => {
    const router = createCalendarRouter({
      controller:    makeController(),
      authenticate:  makeNoop(),
      resolveTenant: makeNoop(),
      authorize:     { requirePermission: () => makeNoop() },
    }) as unknown as { stack: unknown[] };

    expect(router.stack.length).toBeGreaterThanOrEqual(7);
  });
});

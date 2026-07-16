/**
 * Notification Routes Unit Tests
 */

import { Router } from 'express';
import type { RequestHandler } from 'express';
import { createNotificationRouter } from '../routes/notification.routes';
import type { NotificationController } from '../controllers/notification.controller';

function makeNoop(): RequestHandler {
  return (_req, _res, next) => next();
}

function makeController(): NotificationController {
  return {
    createNotification: makeNoop(),
    listNotifications: makeNoop(),
    getNotification: makeNoop(),
    getNotificationByPublicId: makeNoop(),
    sendImmediate: makeNoop(),
    cancelNotification: makeNoop(),
    processQueue: makeNoop(),
    getPatientPreferences: makeNoop(),
    updatePatientPreferences: makeNoop(),
  } as unknown as NotificationController;
}

describe('createNotificationRouter', () => {
  it('should return an Express Router instance', () => {
    const router = createNotificationRouter({
      controller: makeController(),
      authenticate: makeNoop(),
      resolveTenant: makeNoop(),
      authorize: { requirePermission: () => makeNoop() },
    });

    expect(router).toBeDefined();
    expect(typeof router).toBe('function');
  });

  it('should register at least 9 route handlers', () => {
    const router = createNotificationRouter({
      controller: makeController(),
      authenticate: makeNoop(),
      resolveTenant: makeNoop(),
      authorize: { requirePermission: () => makeNoop() },
    }) as unknown as { stack: unknown[] };

    expect(router.stack.length).toBeGreaterThanOrEqual(9);
  });
});

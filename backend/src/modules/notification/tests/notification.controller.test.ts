/**
 * Notification Controller Unit Tests
 */

import type { Request, Response, NextFunction } from 'express';
import { NotificationController, notificationErrorHandler } from '../controllers/notification.controller';
import {
  NotificationNotFoundError,
  NotificationIsolationViolationError,
} from '../errors/notification.errors';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMockService() {
  return {
    createNotification: jest.fn(),
    sendImmediate: jest.fn(),
    processQueue: jest.fn(),
    retryNotification: jest.fn(),
    cancelNotification: jest.fn(),
    getNotificationById: jest.fn(),
    getNotificationByPublicId: jest.fn(),
    listNotifications: jest.fn(),
    getPatientPreferences: jest.fn(),
    updatePatientPreferences: jest.fn(),
  };
}

function makeReq(overrides: Partial<Request> = {}): Request {
  return {
    body: {},
    params: {},
    query: {},
    headers: {},
    tenantId: '550e8400-e29b-41d4-a716-446655440000',
    requestId: 'req-1',
    user: { userId: 'actor-1' } as any,
    ...overrides,
  } as unknown as Request;
}

function makeRes(): { res: Response; status: jest.Mock; json: jest.Mock } {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const res = { status, req: { requestId: 'req-1' } } as unknown as Response;
  return { res, status, json };
}

const next: NextFunction = jest.fn();

const NOTIF_ID = '550e8400-e29b-41d4-a716-446655440004';
const TENANT_ID = '550e8400-e29b-41d4-a716-446655440000';

function makeNotifResponse() {
  return {
    id: NOTIF_ID,
    publicId: 'ntf_abc',
    tenantId: TENANT_ID,
    clinicId: 'c1',
    recipient: 'test@example.com',
    channel: 'email',
    type: 'appointment_confirmation',
    content: 'hello',
    status: 'pending',
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('NotificationController', () => {
  let mockService: ReturnType<typeof makeMockService>;
  let controller: NotificationController;

  beforeEach(() => {
    jest.clearAllMocks();
    mockService = makeMockService();
    controller = new NotificationController(mockService as any);
  });

  describe('createNotification', () => {
    it('should return 201 on valid request', async () => {
      mockService.createNotification.mockResolvedValue(makeNotifResponse());
      const { res } = makeRes();
      const req = makeReq({
        body: {
          clinicId: '550e8400-e29b-41d4-a716-446655440001',
          recipient: 'test@example.com',
          channel: 'email',
          type: 'appointment_confirmation',
          templateName: 'appointment_confirmation',
        },
      });

      await controller.createNotification(req, res, next);

      expect(res.status).toHaveBeenCalledWith(201);
    });

    it('should return 422 on validation failure', async () => {
      const { res } = makeRes();
      const req = makeReq({ body: {} });

      await controller.createNotification(req, res, next);

      expect(res.status).toHaveBeenCalledWith(422);
    });
  });

  describe('sendImmediate', () => {
    it('should return 200 on successful immediate send', async () => {
      mockService.sendImmediate.mockResolvedValue(makeNotifResponse());
      const { res } = makeRes();
      const req = makeReq({ params: { id: NOTIF_ID } });

      await controller.sendImmediate(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(mockService.sendImmediate).toHaveBeenCalledWith(NOTIF_ID, TENANT_ID, 'actor-1', 'req-1');
    });
  });

  describe('notificationErrorHandler', () => {
    it('should handle custom NotificationError and return correct status', () => {
      const err = new NotificationNotFoundError(NOTIF_ID);
      const { res, json } = makeRes();
      const req = { requestId: 'req-1' } as Request;

      notificationErrorHandler(err, req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({ code: 'NOTIFICATION_NOT_FOUND' }),
        }),
      );
    });
  });
});

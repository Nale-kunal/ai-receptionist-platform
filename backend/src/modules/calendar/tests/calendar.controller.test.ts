/**
 * Calendar Controller Unit Tests
 */

import type { Request, Response, NextFunction } from 'express';
import { CalendarController, calendarErrorHandler } from '../controllers/calendar.controller';
import { CalendarConnectionNotFoundError, CalendarIsolationViolationError } from '../errors/calendar.errors';

function makeMockService() {
  return {
    connectCalendar:         jest.fn(),
    disconnectCalendar:      jest.fn(),
    getAvailability:         jest.fn(),
    syncAppointmentCreated:  jest.fn(),
    syncAppointmentUpdated:  jest.fn(),
    syncAppointmentCancelled:jest.fn(),
    syncAppointmentDeleted:  jest.fn(),
    processWebhook:          jest.fn(),
    getConnectionById:       jest.fn(),
    getConnectionByPublicId: jest.fn(),
    listConnections:         jest.fn(),
  };
}

function makeReq(overrides: Partial<Request> = {}): Request {
  return {
    body:      {},
    params:    {},
    query:     {},
    headers:   {},
    tenantId:  '550e8400-e29b-41d4-a716-446655440000',
    requestId: 'req-1',
    user:      { userId: 'actor-1' } as any,
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

describe('CalendarController', () => {
  let mockService: ReturnType<typeof makeMockService>;
  let controller: CalendarController;

  beforeEach(() => {
    jest.clearAllMocks();
    mockService = makeMockService();
    controller = new CalendarController(mockService as any);
  });

  describe('connectCalendar', () => {
    it('should return 201 on valid request', async () => {
      mockService.connectCalendar.mockResolvedValue({ id: 'conn-1', publicId: 'cal_123' });
      const { res } = makeRes();
      const req = makeReq({
        body: {
          clinicId:    '550e8400-e29b-41d4-a716-446655440001',
          provider:    'google',
          calendarId:  'primary',
          accessToken: 'valid-token',
        },
      });

      await controller.connectCalendar(req, res, next);

      expect(res.status).toHaveBeenCalledWith(201);
    });

    it('should return 422 on validation failure', async () => {
      const { res } = makeRes();
      const req = makeReq({ body: {} });

      await controller.connectCalendar(req, res, next);

      expect(res.status).toHaveBeenCalledWith(422);
    });
  });

  describe('disconnectCalendar', () => {
    it('should return 200 on successful disconnection', async () => {
      mockService.disconnectCalendar.mockResolvedValue({ id: 'conn-1', connectionStatus: 'disconnected' });
      const { res } = makeRes();
      const req = makeReq({ params: { id: 'conn-1' } });

      await controller.disconnectCalendar(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(mockService.disconnectCalendar).toHaveBeenCalledWith('conn-1', '550e8400-e29b-41d4-a716-446655440000', 'actor-1', 'req-1');
    });
  });

  describe('calendarErrorHandler', () => {
    it('should catch custom CalendarError and return correct payload', () => {
      const err = new CalendarConnectionNotFoundError('conn-1');
      const { res, json } = makeRes();
      const req = { requestId: 'req-1' } as Request;

      calendarErrorHandler(err, req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error:   expect.objectContaining({ code: 'CALENDAR_CONNECTION_NOT_FOUND' }),
        }),
      );
    });
  });
});

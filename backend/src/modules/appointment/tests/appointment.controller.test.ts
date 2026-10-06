/**
 * Appointment Controller Unit Tests
 */

import type { Request, Response, NextFunction } from 'express';
import { AppointmentController, appointmentErrorHandler } from '../controllers/appointment.controller';
import {
  AppointmentNotFoundError,
  AppointmentConflictError,
} from '../errors/appointment.errors';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMockService() {
  return {
    createAppointment:      jest.fn(),
    updateAppointment:      jest.fn(),
    rescheduleAppointment:  jest.fn(),
    cancelAppointment:      jest.fn(),
    confirmAppointment:     jest.fn(),
    checkInAppointment:   jest.fn(),
    startAppointment:     jest.fn(),
    completeAppointment:    jest.fn(),
    markNoShow:             jest.fn(),
    getAppointmentById:     jest.fn(),
    getAppointmentByPublicId: jest.fn(),
    listAppointments:       jest.fn(),
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
  const json   = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const res    = { status, req: { requestId: 'req-1' } } as unknown as Response;
  return { res, status, json };
}

const next: NextFunction = jest.fn();

const APPT_ID   = '550e8400-e29b-41d4-a716-446655440004';
const TENANT_ID = '550e8400-e29b-41d4-a716-446655440000';

function makeApptResponse() {
  return {
    id: APPT_ID, publicId: 'appt_abc', tenantId: TENANT_ID,
    clinicId: 'c1', doctorId: 'd1', patientId: 'p1',
    startTime: new Date(), endTime: new Date(),
    timezone: 'UTC', status: 'pending', source: 'dashboard',
    notes: null, cancellationReason: null, cancelledAt: null,
    createdAt: new Date(), updatedAt: new Date(), deletedAt: null,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AppointmentController', () => {
  let mockService: ReturnType<typeof makeMockService>;
  let controller: AppointmentController;

  beforeEach(() => {
    jest.clearAllMocks();
    mockService = makeMockService();
    controller  = new AppointmentController(mockService as any);
  });

  // -------------------------------------------------------------------------
  // createAppointment
  // -------------------------------------------------------------------------

  describe('createAppointment', () => {
    it('should return 201 on valid request', async () => {
      mockService.createAppointment.mockResolvedValue(makeApptResponse());
      const { res } = makeRes();
      const req = makeReq({
        body: {
          clinicId:  '550e8400-e29b-41d4-a716-446655440001',
          doctorId:  '550e8400-e29b-41d4-a716-446655440002',
          patientId: '550e8400-e29b-41d4-a716-446655440003',
          startTime: '2025-01-01T09:00:00.000Z',
          endTime:   '2025-01-01T09:30:00.000Z',
        },
      });

      await controller.createAppointment(req, res, next);

      expect(res.status).toHaveBeenCalledWith(201);
    });

    it('should return 422 on validation failure', async () => {
      const { res } = makeRes();
      const req = makeReq({ body: { clinicId: 'not-a-uuid' } });

      await controller.createAppointment(req, res, next);

      expect(res.status).toHaveBeenCalledWith(422);
    });

    it('should return 400 when tenantId is missing', async () => {
      const { res } = makeRes();
      const req = makeReq({ tenantId: undefined as any });

      await controller.createAppointment(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should call next on service error', async () => {
      mockService.createAppointment.mockRejectedValue(new AppointmentConflictError());
      const { res } = makeRes();
      const req = makeReq({
        body: {
          clinicId:  '550e8400-e29b-41d4-a716-446655440001',
          doctorId:  '550e8400-e29b-41d4-a716-446655440002',
          patientId: '550e8400-e29b-41d4-a716-446655440003',
          startTime: '2025-01-01T09:00:00.000Z',
          endTime:   '2025-01-01T09:30:00.000Z',
        },
      });

      await controller.createAppointment(req, res, next);
      expect(next).toHaveBeenCalledWith(expect.any(AppointmentConflictError));
    });
  });

  // -------------------------------------------------------------------------
  // listAppointments
  // -------------------------------------------------------------------------

  describe('listAppointments', () => {
    it('should return 200 with appointments array', async () => {
      mockService.listAppointments.mockResolvedValue([makeApptResponse()]);
      const { res } = makeRes();
      const req = makeReq({ query: {} });

      await controller.listAppointments(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  // -------------------------------------------------------------------------
  // getAppointment
  // -------------------------------------------------------------------------

  describe('getAppointment', () => {
    it('should return 200 with appointment', async () => {
      mockService.getAppointmentById.mockResolvedValue(makeApptResponse());
      const { res } = makeRes();
      const req = makeReq({ params: { id: APPT_ID } });

      await controller.getAppointment(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(mockService.getAppointmentById).toHaveBeenCalledWith(APPT_ID, TENANT_ID);
    });

    it('should call next with AppointmentNotFoundError', async () => {
      mockService.getAppointmentById.mockRejectedValue(new AppointmentNotFoundError(APPT_ID));
      const { res } = makeRes();
      const req = makeReq({ params: { id: APPT_ID } });

      await controller.getAppointment(req, res, next);
      expect(next).toHaveBeenCalledWith(expect.any(AppointmentNotFoundError));
    });
  });

  // -------------------------------------------------------------------------
  // cancelAppointment
  // -------------------------------------------------------------------------

  describe('cancelAppointment', () => {
    it('should return 200 on valid cancel request', async () => {
      mockService.cancelAppointment.mockResolvedValue(makeApptResponse());
      const { res } = makeRes();
      const req = makeReq({ params: { id: APPT_ID }, body: { cancellationReason: 'Patient request' } });

      await controller.cancelAppointment(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  // -------------------------------------------------------------------------
  // checkInAppointment & startAppointment
  // -------------------------------------------------------------------------

  describe('checkInAppointment', () => {
    it('should return 200 on valid check-in request', async () => {
      mockService.checkInAppointment.mockResolvedValue(makeApptResponse());
      const { res } = makeRes();
      const req = makeReq({ params: { id: APPT_ID } });

      await controller.checkInAppointment(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(mockService.checkInAppointment).toHaveBeenCalledWith(APPT_ID, TENANT_ID, 'actor-1', 'req-1');
    });
  });

  describe('startAppointment', () => {
    it('should return 200 on valid start request', async () => {
      mockService.startAppointment.mockResolvedValue(makeApptResponse());
      const { res } = makeRes();
      const req = makeReq({ params: { id: APPT_ID } });

      await controller.startAppointment(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(mockService.startAppointment).toHaveBeenCalledWith(APPT_ID, TENANT_ID, 'actor-1', 'req-1');
    });
  });

  // -------------------------------------------------------------------------
  // appointmentErrorHandler
  // -------------------------------------------------------------------------

  describe('appointmentErrorHandler', () => {
    it('should return proper error JSON for AppointmentError', () => {
      const err = new AppointmentNotFoundError(APPT_ID);
      const { res, json } = makeRes();
      const req = { requestId: 'req-1' } as Request;

      appointmentErrorHandler(err, req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({ code: 'APPOINTMENT_NOT_FOUND' }),
        }),
      );
    });

    it('should pass non-AppointmentErrors to next', () => {
      const err = new Error('Unknown error');
      const { res } = makeRes();
      const req = { requestId: 'req-1' } as Request;

      appointmentErrorHandler(err, req, res, next);

      expect(next).toHaveBeenCalledWith(err);
    });
  });
});

/**
 * Doctor Controller Unit Tests
 */

import { DoctorController } from '../controllers/doctor.controller';
import { DoctorError } from '../errors/doctor.errors';

const mockService = {
  createDoctor: jest.fn(),
  updateDoctor: jest.fn(),
  getDoctorById: jest.fn(),
  getDoctorByPublicId: jest.fn(),
  listDoctors: jest.fn(),
  transitionStatus: jest.fn(),
  updateWorkingHours: jest.fn(),
  updateLeaves: jest.fn(),
  softDeleteDoctor: jest.fn(),
  restoreDoctor: jest.fn(),
};

function makeRequest(overrides: Record<string, unknown> = {}): any {
  return {
    tenantId: '550e8400-e29b-41d4-a716-446655440000',
    requestId: 'req-123',
    user: { userId: 'u-1', tenantId: '550e8400-e29b-41d4-a716-446655440000', role: 'admin', clinicId: null },
    params: {},
    query: {},
    body: {},
    ...overrides,
  };
}

function makeResponse(): any {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.req = {};
  return {
    res,
    status: res.status,
    json: res.json,
  };
}

describe('DoctorController', () => {
  let controller: DoctorController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new DoctorController(mockService as any);
  });

  describe('createDoctor', () => {
    const validBody = {
      clinicId: '550e8400-e29b-41d4-a716-446655440002',
      fullName: 'Dr. John Doe',
      displayName: 'Dr. Doe',
      specialization: 'General Dentistry',
    };

    it('should validate request body and call service returning 201 on success', async () => {
      mockService.createDoctor.mockResolvedValue({ id: 'd-1', fullName: 'Dr. John Doe' });

      const req = makeRequest({ body: validBody });
      const { res, status, json } = makeResponse();
      const next = jest.fn();

      await controller.createDoctor(req, res, next);

      expect(mockService.createDoctor).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: '550e8400-e29b-41d4-a716-446655440000',
          fullName: 'Dr. John Doe',
        }),
      );
      expect(status).toHaveBeenCalledWith(201);
      expect(json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
        }),
      );
    });

    it('should return 422 validation error if body schema check fails', async () => {
      const req = makeRequest({ body: { invalid: 'payload' } });
      const { res, status, json } = makeResponse();
      const next = jest.fn();

      await controller.createDoctor(req, res, next);

      expect(mockService.createDoctor).not.toHaveBeenCalled();
      expect(status).toHaveBeenCalledWith(422);
    });
  });

  describe('getDoctor', () => {
    it('should query service by ID and return 200', async () => {
      mockService.getDoctorById.mockResolvedValue({ id: 'd-1' });

      const req = makeRequest({ params: { id: 'd-1' } });
      const { res, status, json } = makeResponse();
      const next = jest.fn();

      await controller.getDoctor(req, res, next);

      expect(mockService.getDoctorById).toHaveBeenCalledWith('d-1', '550e8400-e29b-41d4-a716-446655440000');
      expect(status).toHaveBeenCalledWith(200);
      expect(json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: { doctor: { id: 'd-1' } },
        }),
      );
    });
  });
});

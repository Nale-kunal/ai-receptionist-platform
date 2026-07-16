/**
 * Patient Controller Unit Tests
 */

import { PatientController } from '../controllers/patient.controller';

const mockService = {
  createPatient: jest.fn(),
  updatePatient: jest.fn(),
  getPatientById: jest.fn(),
  getPatientByPublicId: jest.fn(),
  listPatients: jest.fn(),
  transitionStatus: jest.fn(),
  softDeletePatient: jest.fn(),
  restorePatient: jest.fn(),
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

describe('PatientController', () => {
  let controller: PatientController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new PatientController(mockService as any);
  });

  describe('createPatient', () => {
    const validBody = {
      clinicId: '550e8400-e29b-41d4-a716-446655440002',
      fullName: 'Jane Smith',
      phone: '+15555554321',
      email: 'janesmith@example.com',
    };

    it('should validate request body and call service returning 201 on success', async () => {
      mockService.createPatient.mockResolvedValue({ id: 'p-1', fullName: 'Jane Smith' });

      const req = makeRequest({ body: validBody });
      const { res, status, json } = makeResponse();
      const next = jest.fn();

      await controller.createPatient(req, res, next);

      expect(mockService.createPatient).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: '550e8400-e29b-41d4-a716-446655440000',
          fullName: 'Jane Smith',
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

      await controller.createPatient(req, res, next);

      expect(mockService.createPatient).not.toHaveBeenCalled();
      expect(status).toHaveBeenCalledWith(422);
    });
  });

  describe('getPatient', () => {
    it('should query service by ID and return 200', async () => {
      mockService.getPatientById.mockResolvedValue({ id: 'p-1' });

      const req = makeRequest({ params: { id: 'p-1' } });
      const { res, status, json } = makeResponse();
      const next = jest.fn();

      await controller.getPatient(req, res, next);

      expect(mockService.getPatientById).toHaveBeenCalledWith('p-1', '550e8400-e29b-41d4-a716-446655440000');
      expect(status).toHaveBeenCalledWith(200);
      expect(json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: { patient: { id: 'p-1' } },
        }),
      );
    });
  });
});

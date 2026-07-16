/**
 * Clinic Controller Unit Tests
 */

import { ClinicController } from '../controllers/clinic.controller';
import { ClinicError } from '../errors/clinic.errors';

const mockService = {
  createClinic: jest.fn(),
  updateClinic: jest.fn(),
  getClinicById: jest.fn(),
  getClinicBySlug: jest.fn(),
  listClinics: jest.fn(),
  transitionStatus: jest.fn(),
  transferOwnership: jest.fn(),
  softDeleteClinic: jest.fn(),
  restoreClinic: jest.fn(),
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

describe('ClinicController', () => {
  let controller: ClinicController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new ClinicController(mockService as any);
  });

  describe('createClinic', () => {
    const validBody = {
      ownerId: '550e8400-e29b-41d4-a716-446655440002',
      name: 'Smile Care',
      slug: 'smile-care',
      timezone: 'UTC',
      country: 'US',
    };

    it('should validate request body and call service returning 201 on success', async () => {
      mockService.createClinic.mockResolvedValue({ id: 'c-1', slug: 'smile-care' });

      const req = makeRequest({ body: validBody });
      const { res, status, json } = makeResponse();
      const next = jest.fn();

      await controller.createClinic(req, res, next);

      expect(mockService.createClinic).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: '550e8400-e29b-41d4-a716-446655440000',
          name: 'Smile Care',
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

      await controller.createClinic(req, res, next);

      expect(mockService.createClinic).not.toHaveBeenCalled();
      expect(status).toHaveBeenCalledWith(422);
      expect(json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({ code: 'VALIDATION_FAILED' }),
        }),
      );
    });
  });

  describe('getClinic', () => {
    it('should query service by ID and return 200', async () => {
      mockService.getClinicById.mockResolvedValue({ id: 'c-1' });

      const req = makeRequest({ params: { id: 'c-1' } });
      const { res, status, json } = makeResponse();
      const next = jest.fn();

      await controller.getClinic(req, res, next);

      expect(mockService.getClinicById).toHaveBeenCalledWith('c-1', '550e8400-e29b-41d4-a716-446655440000');
      expect(status).toHaveBeenCalledWith(200);
      expect(json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: { clinic: { id: 'c-1' } },
        }),
      );
    });
  });
});

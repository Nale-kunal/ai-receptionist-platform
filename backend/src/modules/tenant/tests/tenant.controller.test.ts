/**
 * Tenant Controller Unit Tests
 *
 * Verifies request validation parsing and mapping to service methods.
 */

import { TenantController } from '../controllers/tenant.controller';

const mockTenantService = {
  createTenant: jest.fn(),
  updateTenant: jest.fn(),
  getTenantById: jest.fn(),
  getTenantBySlug: jest.fn(),
  listTenants: jest.fn(),
  activateTenant: jest.fn(),
  suspendTenant: jest.fn(),
  archiveTenant: jest.fn(),
  softDeleteTenant: jest.fn(),
  restoreTenant: jest.fn(),
  updateSubscriptionPlan: jest.fn(),
};

function makeRequest(body: any = {}, params: any = {}, query: any = {}, user: any = { userId: 'actor-1' }): any {
  return {
    body,
    params,
    query,
    user,
    requestId: 'test-req-id',
  };
}

function makeResponse(): any {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.req = { requestId: 'test-req-id' };
  return res;
}

describe('TenantController', () => {
  let controller: TenantController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new TenantController(mockTenantService as any);
  });

  describe('createTenant', () => {
    it('should return 201 and safe tenant on success', async () => {
      const payload = {
        name: 'Smile Clinic',
        slug: 'smile-clinic',
      };
      const req = makeRequest(payload);
      const res = makeResponse();
      const next = jest.fn();

      const mockSafeTenant = { id: 'id-1', name: 'Smile Clinic', slug: 'smile-clinic' };
      mockTenantService.createTenant.mockResolvedValue(mockSafeTenant);

      await controller.createTenant(req, res, next);

      expect(mockTenantService.createTenant).toHaveBeenCalledTimes(1);
      expect(mockTenantService.createTenant).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Smile Clinic',
          slug: 'smile-clinic',
          actorId: 'actor-1',
          requestId: 'test-req-id',
        }),
      );
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: { tenant: mockSafeTenant },
        }),
      );
    });

    it('should return 422 validation error on bad request payload', async () => {
      const payload = {
        name: '', // Empty name
        slug: 'invalid_slug',
      };
      const req = makeRequest(payload);
      const res = makeResponse();
      const next = jest.fn();

      await controller.createTenant(req, res, next);

      expect(mockTenantService.createTenant).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(422);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'VALIDATION_FAILED',
          }),
        }),
      );
    });
  });

  describe('getTenant', () => {
    it('should call service and return 200', async () => {
      const req = makeRequest({}, { id: 'tenant-id-123' });
      const res = makeResponse();
      const next = jest.fn();

      const mockSafeTenant = { id: 'tenant-id-123', name: 'Clinic' };
      mockTenantService.getTenantById.mockResolvedValue(mockSafeTenant);

      await controller.getTenant(req, res, next);

      expect(mockTenantService.getTenantById).toHaveBeenCalledWith('tenant-id-123');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: { tenant: mockSafeTenant },
        }),
      );
    });
  });

  describe('updateSubscription', () => {
    it('should call updateSubscriptionPlan and return 200', async () => {
      const req = makeRequest({ subscriptionPlan: 'premium' }, { id: 'tenant-id-123' });
      const res = makeResponse();
      const next = jest.fn();

      mockTenantService.updateSubscriptionPlan.mockResolvedValue({ id: 'tenant-id-123', subscriptionPlan: 'premium' });

      await controller.updateSubscription(req, res, next);

      expect(mockTenantService.updateSubscriptionPlan).toHaveBeenCalledWith(
        'tenant-id-123',
        'premium',
        'actor-1',
        'test-req-id',
      );
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });
});

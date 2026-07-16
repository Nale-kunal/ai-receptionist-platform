/**
 * Tenant Resolution Middleware Unit Tests
 */

import type { Request, Response, NextFunction } from 'express';
import { createTenantResolutionMiddleware } from '../middleware/tenant-resolution.middleware';
import {
  TENANT_STATUS_ACTIVE,
  TENANT_STATUS_SUSPENDED,
  TENANT_STATUS_ARCHIVED,
} from '../constants/tenant.constants';

const mockTenantService = {
  getTenantById: jest.fn(),
  getTenantBySlug: jest.fn(),
};

function makeRequest(overrides: Partial<Request> = {}): Partial<Request> {
  return {
    method: 'GET',
    headers: {},
    query: {},
    params: {},
    body: {},
    requestId: 'test-req-id',
    socket: { remoteAddress: '127.0.0.1' } as any,
    ...overrides,
  } as any;
}

function makeResponse(): { res: Partial<Response>; status: jest.Mock; json: jest.Mock } {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  return {
    res: { status, json } as any,
    status,
    json,
  };
}

describe('TenantResolutionMiddleware', () => {
  let middleware: any;

  const TENANT_UUID = '550e8400-e29b-41d4-a716-446655440000';
  const OVERRIDE_UUID = '550e8400-e29b-41d4-a716-446655440001';
  const FOREIGN_UUID = '550e8400-e29b-41d4-a716-446655440002';
  const SYSTEM_UUID = '550e8400-e29b-41d4-a716-446655440003';

  beforeEach(() => {
    jest.clearAllMocks();
    middleware = createTenantResolutionMiddleware(mockTenantService as any);
  });

  it('should resolve tenant from req.user (JWT) and call next()', async () => {
    const req = makeRequest({
      user: { userId: 'u-1', tenantId: TENANT_UUID, role: 'clinic_owner', clinicId: null, tokenVersion: 1, email: 'owner@example.com', sessionId: 's-1' },
    });
    const { res } = makeResponse();
    const next = jest.fn();

    mockTenantService.getTenantById.mockResolvedValue({
      id: TENANT_UUID,
      name: 'Smile',
      status: TENANT_STATUS_ACTIVE,
      timezone: 'UTC',
      language: 'en',
      country: 'US',
    });

    await middleware(req, res, next);

    expect(mockTenantService.getTenantById).toHaveBeenCalledWith(TENANT_UUID);
    expect(req.tenantId).toBe(TENANT_UUID);
    expect(req.tenantContext?.locale).toBe('en-US');
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('should allow super_admin to override tenant context', async () => {
    const req = makeRequest({
      user: { userId: 'admin', tenantId: SYSTEM_UUID, role: 'super_admin', clinicId: null, tokenVersion: 1, email: 'admin@system.com', sessionId: 's-1' },
      query: { tenantId: OVERRIDE_UUID },
    });
    const { res } = makeResponse();
    const next = jest.fn();

    mockTenantService.getTenantById.mockResolvedValue({
      id: OVERRIDE_UUID,
      name: 'Smile',
      status: TENANT_STATUS_ACTIVE,
      timezone: 'UTC',
      language: 'en',
      country: 'US',
    });

    await middleware(req, res, next);

    expect(mockTenantService.getTenantById).toHaveBeenCalledWith(OVERRIDE_UUID);
    expect(req.tenantId).toBe(OVERRIDE_UUID);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('should reject parameter override for non-super-admins trying to target another tenant', async () => {
    const req = makeRequest({
      user: { userId: 'u-1', tenantId: TENANT_UUID, role: 'clinic_owner', clinicId: null, tokenVersion: 1, email: 'owner@example.com', sessionId: 's-1' },
      query: { tenantId: FOREIGN_UUID },
    });
    const { res, status, json } = makeResponse();
    const next = jest.fn();

    await middleware(req, res, next);

    expect(status).toHaveBeenCalledWith(403);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({
          code: 'FORBIDDEN',
        }),
      }),
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 403 Forbidden for suspended tenants', async () => {
    const req = makeRequest({
      user: { userId: 'u-1', tenantId: TENANT_UUID, role: 'clinic_owner', clinicId: null, tokenVersion: 1, email: 'owner@example.com', sessionId: 's-1' },
    });
    const { res, status } = makeResponse();
    const next = jest.fn();

    mockTenantService.getTenantById.mockResolvedValue({
      id: TENANT_UUID,
      name: 'Smile',
      status: TENANT_STATUS_SUSPENDED,
      timezone: 'UTC',
      language: 'en',
      country: 'US',
    });

    await middleware(req, res, next);

    expect(status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('should allow GET requests on archived tenants', async () => {
    const req = makeRequest({
      method: 'GET',
      user: { userId: 'u-1', tenantId: TENANT_UUID, role: 'clinic_owner', clinicId: null, tokenVersion: 1, email: 'owner@example.com', sessionId: 's-1' },
    });
    const { res } = makeResponse();
    const next = jest.fn();

    mockTenantService.getTenantById.mockResolvedValue({
      id: TENANT_UUID,
      name: 'Smile',
      status: TENANT_STATUS_ARCHIVED,
      timezone: 'UTC',
      language: 'en',
      country: 'US',
    });

    await middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  it('should block POST/PUT/DELETE write requests on archived tenants', async () => {
    const req = makeRequest({
      method: 'POST',
      user: { userId: 'u-1', tenantId: TENANT_UUID, role: 'clinic_owner', clinicId: null, tokenVersion: 1, email: 'owner@example.com', sessionId: 's-1' },
    });
    const { res, status } = makeResponse();
    const next = jest.fn();

    mockTenantService.getTenantById.mockResolvedValue({
      id: TENANT_UUID,
      name: 'Smile',
      status: TENANT_STATUS_ARCHIVED,
      timezone: 'UTC',
      language: 'en',
      country: 'US',
    });

    await middleware(req, res, next);

    expect(status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
});

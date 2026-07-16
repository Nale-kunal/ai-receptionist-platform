/**
 * Tenant Routes Integration / Routing Tests
 *
 * Verifies that the tenant router binds endpoints with appropriate middleware guards.
 */

import express, { type Application } from 'express';
import request from 'supertest';
import { createTenantRouter } from '../routes/tenant.routes';

const mockController = {
  listTenants: jest.fn((req, res) => res.status(200).json({ success: true, data: { tenants: [] } })),
  createTenant: jest.fn((req, res) => res.status(201).json({ success: true, data: {} })),
  getTenant: jest.fn((req, res) => res.status(200).json({ success: true, data: {} })),
  getTenantBySlug: jest.fn((req, res) => res.status(200).json({ success: true, data: {} })),
  updateTenant: jest.fn((req, res) => res.status(200).json({ success: true, data: {} })),
  activateTenant: jest.fn((req, res) => res.status(200).json({ success: true, data: {} })),
  suspendTenant: jest.fn((req, res) => res.status(200).json({ success: true, data: {} })),
  archiveTenant: jest.fn((req, res) => res.status(200).json({ success: true, data: {} })),
  deleteTenant: jest.fn((req, res) => res.status(200).json({ success: true, data: {} })),
  restoreTenant: jest.fn((req, res) => res.status(200).json({ success: true, data: {} })),
  updateSubscription: jest.fn((req, res) => res.status(200).json({ success: true, data: {} })),
};

const mockAuthenticate = jest.fn((req, res, next) => {
  req.user = { userId: 'admin-user', role: 'super_admin' };
  next();
});

const mockAuthorize = {
  requirePermission: jest.fn((perm) => (req: any, res: any, next: any) => next()),
};

function createTestApp(): Application {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    req.requestId = 'test-request-id';
    next();
  });

  const router = createTenantRouter({
    controller: mockController as any,
    authenticate: mockAuthenticate as any,
    authorize: mockAuthorize as any,
  });

  app.use('/api/v1/tenants', router);
  return app;
}

describe('Tenant Routes', () => {
  let app: Application;

  beforeEach(() => {
    jest.clearAllMocks();
    app = createTestApp();
  });

  it('GET /api/v1/tenants should hit controller.listTenants', async () => {
    const res = await request(app).get('/api/v1/tenants');
    expect(res.status).toBe(200);
    expect(mockAuthenticate).toHaveBeenCalledTimes(1);
    expect(mockAuthorize.requirePermission).toHaveBeenCalledWith('admin.tenant.manage');
    expect(mockController.listTenants).toHaveBeenCalledTimes(1);
  });

  it('POST /api/v1/tenants should hit controller.createTenant', async () => {
    const res = await request(app).post('/api/v1/tenants').send({ name: 'test' });
    expect(res.status).toBe(201);
    expect(mockController.createTenant).toHaveBeenCalledTimes(1);
  });

  it('DELETE /api/v1/tenants/:id should hit controller.deleteTenant', async () => {
    const res = await request(app).delete('/api/v1/tenants/some-uuid');
    expect(res.status).toBe(200);
    expect(mockController.deleteTenant).toHaveBeenCalledTimes(1);
  });
});

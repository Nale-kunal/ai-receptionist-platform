/**
 * Clinic Routes Integration / Routing Tests
 */

import express, { type Application } from 'express';
import request from 'supertest';
import { createClinicRouter } from '../routes/clinic.routes';

const mockController = {
  listClinics: jest.fn((req, res) => res.status(200).json({ success: true, data: {} })),
  createClinic: jest.fn((req, res) => res.status(201).json({ success: true, data: {} })),
  getClinic: jest.fn((req, res) => res.status(200).json({ success: true, data: {} })),
  getClinicBySlug: jest.fn((req, res) => res.status(200).json({ success: true, data: {} })),
  updateClinic: jest.fn((req, res) => res.status(200).json({ success: true, data: {} })),
  transitionStatus: jest.fn((req, res) => res.status(200).json({ success: true, data: {} })),
  transferOwnership: jest.fn((req, res) => res.status(200).json({ success: true, data: {} })),
  deleteClinic: jest.fn((req, res) => res.status(200).json({ success: true, data: {} })),
  restoreClinic: jest.fn((req, res) => res.status(200).json({ success: true, data: {} })),
};

const mockAuthenticate = jest.fn((req, res, next) => {
  req.user = { userId: 'u-1', role: 'admin' };
  next();
});

const mockResolveTenant = jest.fn((req, res, next) => {
  req.tenantId = '550e8400-e29b-41d4-a716-446655440000';
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

  const router = createClinicRouter({
    controller: mockController as any,
    authenticate: mockAuthenticate as any,
    resolveTenant: mockResolveTenant as any,
    authorize: mockAuthorize as any,
  });

  app.use('/api/v1/clinics', router);
  return app;
}

describe('Clinic Routes', () => {
  let app: Application;

  beforeEach(() => {
    jest.clearAllMocks();
    app = createTestApp();
  });

  it('GET /api/v1/clinics should hit controller.listClinics', async () => {
    const res = await request(app).get('/api/v1/clinics');
    expect(res.status).toBe(200);
    expect(mockAuthenticate).toHaveBeenCalledTimes(1);
    expect(mockResolveTenant).toHaveBeenCalledTimes(1);
    expect(mockAuthorize.requirePermission).toHaveBeenCalledWith('clinic.read');
    expect(mockController.listClinics).toHaveBeenCalledTimes(1);
  });

  it('POST /api/v1/clinics should hit controller.createClinic', async () => {
    const res = await request(app).post('/api/v1/clinics').send({ name: 'test' });
    expect(res.status).toBe(201);
    expect(mockController.createClinic).toHaveBeenCalledTimes(1);
  });

  it('DELETE /api/v1/clinics/:id should hit controller.deleteClinic', async () => {
    const res = await request(app).delete('/api/v1/clinics/some-id');
    expect(res.status).toBe(200);
    expect(mockController.deleteClinic).toHaveBeenCalledTimes(1);
  });
});

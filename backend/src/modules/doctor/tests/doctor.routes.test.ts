/**
 * Doctor Routes Integration / Routing Tests
 */

import express, { type Application } from 'express';
import request from 'supertest';
import { createDoctorRouter } from '../routes/doctor.routes';

const mockController = {
  listDoctors: jest.fn((req, res) => res.status(200).json({ success: true, data: {} })),
  createDoctor: jest.fn((req, res) => res.status(201).json({ success: true, data: {} })),
  getDoctor: jest.fn((req, res) => res.status(200).json({ success: true, data: {} })),
  getDoctorByPublicId: jest.fn((req, res) => res.status(200).json({ success: true, data: {} })),
  updateDoctor: jest.fn((req, res) => res.status(200).json({ success: true, data: {} })),
  transitionStatus: jest.fn((req, res) => res.status(200).json({ success: true, data: {} })),
  updateWorkingHours: jest.fn((req, res) => res.status(200).json({ success: true, data: {} })),
  updateLeaves: jest.fn((req, res) => res.status(200).json({ success: true, data: {} })),
  deleteDoctor: jest.fn((req, res) => res.status(200).json({ success: true, data: {} })),
  restoreDoctor: jest.fn((req, res) => res.status(200).json({ success: true, data: {} })),
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

  const router = createDoctorRouter({
    controller: mockController as any,
    authenticate: mockAuthenticate as any,
    resolveTenant: mockResolveTenant as any,
    authorize: mockAuthorize as any,
  });

  app.use('/api/v1/doctors', router);
  return app;
}

describe('Doctor Routes', () => {
  let app: Application;

  beforeEach(() => {
    jest.clearAllMocks();
    app = createTestApp();
  });

  it('GET /api/v1/doctors should hit controller.listDoctors', async () => {
    const res = await request(app).get('/api/v1/doctors');
    expect(res.status).toBe(200);
    expect(mockAuthenticate).toHaveBeenCalledTimes(1);
    expect(mockResolveTenant).toHaveBeenCalledTimes(1);
    expect(mockAuthorize.requirePermission).toHaveBeenCalledWith('doctor.read');
    expect(mockController.listDoctors).toHaveBeenCalledTimes(1);
  });

  it('POST /api/v1/doctors should hit controller.createDoctor', async () => {
    const res = await request(app).post('/api/v1/doctors').send({ name: 'test' });
    expect(res.status).toBe(201);
    expect(mockController.createDoctor).toHaveBeenCalledTimes(1);
  });

  it('DELETE /api/v1/doctors/:id should hit controller.deleteDoctor', async () => {
    const res = await request(app).delete('/api/v1/doctors/some-id');
    expect(res.status).toBe(200);
    expect(mockController.deleteDoctor).toHaveBeenCalledTimes(1);
  });
});

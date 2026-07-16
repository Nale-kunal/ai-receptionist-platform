/**
 * Patient Routes Integration / Routing Tests
 */

import express, { type Application } from 'express';
import request from 'supertest';
import { createPatientRouter } from '../routes/patient.routes';

const mockController = {
  listPatients: jest.fn((req, res) => res.status(200).json({ success: true, data: {} })),
  createPatient: jest.fn((req, res) => res.status(201).json({ success: true, data: {} })),
  getPatient: jest.fn((req, res) => res.status(200).json({ success: true, data: {} })),
  getPatientByPublicId: jest.fn((req, res) => res.status(200).json({ success: true, data: {} })),
  updatePatient: jest.fn((req, res) => res.status(200).json({ success: true, data: {} })),
  transitionStatus: jest.fn((req, res) => res.status(200).json({ success: true, data: {} })),
  deletePatient: jest.fn((req, res) => res.status(200).json({ success: true, data: {} })),
  restorePatient: jest.fn((req, res) => res.status(200).json({ success: true, data: {} })),
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

  const router = createPatientRouter({
    controller: mockController as any,
    authenticate: mockAuthenticate as any,
    resolveTenant: mockResolveTenant as any,
    authorize: mockAuthorize as any,
  });

  app.use('/api/v1/patients', router);
  return app;
}

describe('Patient Routes', () => {
  let app: Application;

  beforeEach(() => {
    jest.clearAllMocks();
    app = createTestApp();
  });

  it('GET /api/v1/patients should hit controller.listPatients', async () => {
    const res = await request(app).get('/api/v1/patients');
    expect(res.status).toBe(200);
    expect(mockAuthenticate).toHaveBeenCalledTimes(1);
    expect(mockResolveTenant).toHaveBeenCalledTimes(1);
    expect(mockAuthorize.requirePermission).toHaveBeenCalledWith('patient.read');
    expect(mockController.listPatients).toHaveBeenCalledTimes(1);
  });

  it('POST /api/v1/patients should hit controller.createPatient', async () => {
    const res = await request(app).post('/api/v1/patients').send({ fullName: 'test', phone: '+15555554321' });
    expect(res.status).toBe(201);
    expect(mockController.createPatient).toHaveBeenCalledTimes(1);
  });

  it('DELETE /api/v1/patients/:id should hit controller.deletePatient', async () => {
    const res = await request(app).delete('/api/v1/patients/some-id');
    expect(res.status).toBe(200);
    expect(mockController.deletePatient).toHaveBeenCalledTimes(1);
  });
});

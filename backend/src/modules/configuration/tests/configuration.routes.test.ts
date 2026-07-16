/**
 * Configuration Routes Integration / Routing Tests
 */

import express, { type Application } from 'express';
import request from 'supertest';
import { createConfigurationRouter } from '../routes/configuration.routes';

const mockController = {
  getActiveConfiguration: jest.fn((req, res) => res.status(200).json({ success: true, data: {} })),
  getConfigurationById: jest.fn((req, res) => res.status(200).json({ success: true, data: {} })),
  listConfigurationHistory: jest.fn((req, res) => res.status(200).json({ success: true, data: {} })),
  createConfiguration: jest.fn((req, res) => res.status(201).json({ success: true, data: {} })),
  updateConfiguration: jest.fn((req, res) => res.status(200).json({ success: true, data: {} })),
  rollbackConfiguration: jest.fn((req, res) => res.status(200).json({ success: true, data: {} })),
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

  const router = createConfigurationRouter({
    controller: mockController as any,
    authenticate: mockAuthenticate as any,
    resolveTenant: mockResolveTenant as any,
    authorize: mockAuthorize as any,
  });

  app.use('/api/v1/configurations', router);
  return app;
}

describe('Configuration Routes', () => {
  let app: Application;

  beforeEach(() => {
    jest.clearAllMocks();
    app = createTestApp();
  });

  it('GET /api/v1/configurations should hit controller.getActiveConfiguration', async () => {
    const res = await request(app).get('/api/v1/configurations');
    expect(res.status).toBe(200);
    expect(mockAuthenticate).toHaveBeenCalledTimes(1);
    expect(mockResolveTenant).toHaveBeenCalledTimes(1);
    expect(mockAuthorize.requirePermission).toHaveBeenCalledWith('clinic.settings.read');
    expect(mockController.getActiveConfiguration).toHaveBeenCalledTimes(1);
  });

  it('POST /api/v1/configurations should hit controller.createConfiguration', async () => {
    const res = await request(app).post('/api/v1/configurations').send({ settings: {} });
    expect(res.status).toBe(201);
    expect(mockController.createConfiguration).toHaveBeenCalledTimes(1);
  });

  it('POST /api/v1/configurations/:id/rollback should hit controller.rollbackConfiguration', async () => {
    const res = await request(app).post('/api/v1/configurations/some-id/rollback').send({ changeSummary: 'rollback' });
    expect(res.status).toBe(200);
    expect(mockController.rollbackConfiguration).toHaveBeenCalledTimes(1);
  });
});

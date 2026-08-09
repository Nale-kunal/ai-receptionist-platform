import express, { type Application } from 'express';
import request from 'supertest';
import { HealthController } from '../health.controller';
import { createHealthRoutes } from '../health.routes';

describe('Health Monitoring Endpoint Integration Tests', () => {
  let app: Application;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
    };

    const controller = new HealthController(mockPrisma);
    const routes = createHealthRoutes(controller);

    app = express();
    app.use(express.json());
    app.use('/api/v1/health', routes);
  });

  it('GET /api/v1/health returns HTTP 200 with healthy service status payload', async () => {
    const res = await request(app).get('/api/v1/health');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('healthy');
    expect(res.body.data.services.database.status).toBe('healthy');
    expect(res.body.data.services.voiceServer.status).toBe('healthy');
    expect(res.body.data.services.aiEngine.status).toBe('healthy');
    expect(res.body.data.memory).toHaveProperty('heapUsedMb');
  });

  it('GET /api/v1/health returns HTTP 503 degraded status if DB ping fails', async () => {
    mockPrisma.$queryRaw.mockRejectedValueOnce(new Error('DB Connection Refused'));

    const res = await request(app).get('/api/v1/health');

    expect(res.status).toBe(503);
    expect(res.body.success).toBe(false);
    expect(res.body.data.status).toBe('degraded');
    expect(res.body.data.services.database.status).toBe('unhealthy');
  });
});

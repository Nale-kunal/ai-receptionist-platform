/**
 * Prompt Engine Routes — Unit Tests
 *
 * Verifies route registration, path structure, and that correct permission guards are attached.
 */

import express, { type Application } from 'express';
import request from 'supertest';
import { createPromptEngineRouter } from '../routes/prompt-engine.routes';
import type { PromptEngineController } from '../controllers/prompt-engine.controller';
import type { AuthorizeMiddleware } from '../routes/prompt-engine.routes';
import type { RequestHandler } from 'express';

// ---------------------------------------------------------------------------
// Mock controller + middleware
// ---------------------------------------------------------------------------

const noop: RequestHandler = (_req, res) => res.status(200).json({ success: true });

function mockController(): jest.Mocked<PromptEngineController> {
  return {
    createPrompt:     jest.fn(noop) as unknown as PromptEngineController['createPrompt'],
    listPrompts:      jest.fn(noop) as unknown as PromptEngineController['listPrompts'],
    getPrompt:        jest.fn(noop) as unknown as PromptEngineController['getPrompt'],
    updatePrompt:     jest.fn(noop) as unknown as PromptEngineController['updatePrompt'],
    publishPrompt:    jest.fn(noop) as unknown as PromptEngineController['publishPrompt'],
    archivePrompt:    jest.fn(noop) as unknown as PromptEngineController['archivePrompt'],
    rollbackPrompt:   jest.fn(noop) as unknown as PromptEngineController['rollbackPrompt'],
    getPromptHistory: jest.fn(noop) as unknown as PromptEngineController['getPromptHistory'],
    compose:          jest.fn(noop) as unknown as PromptEngineController['compose'],
    listAuditLogs:    jest.fn(noop) as unknown as PromptEngineController['listAuditLogs'],
  } as jest.Mocked<PromptEngineController>;
}

// Capture which permissions were requested by the authorize middleware
const capturedPermissions: string[] = [];

const passThrough: RequestHandler = (_req, _res, next) => next();

const authorize: AuthorizeMiddleware = {
  requirePermission(permission: string): RequestHandler {
    return (req, _res, next) => {
      capturedPermissions.push(permission);
      next();
    };
  },
};

function buildApp(controller: PromptEngineController): Application {
  const app = express();
  app.use(express.json());
  app.use(
    '/api/v1/prompt-engine',
    createPromptEngineRouter({
      controller,
      authenticate:  passThrough,
      resolveTenant: passThrough,
      authorize,
    }),
  );
  return app;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Prompt Engine Routes', () => {
  let controller: jest.Mocked<PromptEngineController>;
  let app: Application;

  beforeEach(() => {
    capturedPermissions.length = 0;
    controller = mockController();
    app = buildApp(controller);
  });

  it('POST /prompts — calls createPrompt', async () => {
    await request(app).post('/api/v1/prompt-engine/prompts').send({});
    expect(controller.createPrompt).toHaveBeenCalled();
  });

  it('GET /prompts — calls listPrompts', async () => {
    await request(app).get('/api/v1/prompt-engine/prompts');
    expect(controller.listPrompts).toHaveBeenCalled();
  });

  it('GET /prompts/:id — calls getPrompt', async () => {
    await request(app).get('/api/v1/prompt-engine/prompts/abc-123');
    expect(controller.getPrompt).toHaveBeenCalled();
  });

  it('PATCH /prompts/:id — calls updatePrompt', async () => {
    await request(app).patch('/api/v1/prompt-engine/prompts/abc-123').send({});
    expect(controller.updatePrompt).toHaveBeenCalled();
  });

  it('POST /prompts/:id/publish — calls publishPrompt', async () => {
    await request(app).post('/api/v1/prompt-engine/prompts/abc-123/publish');
    expect(controller.publishPrompt).toHaveBeenCalled();
  });

  it('POST /prompts/:id/archive — calls archivePrompt', async () => {
    await request(app).post('/api/v1/prompt-engine/prompts/abc-123/archive');
    expect(controller.archivePrompt).toHaveBeenCalled();
  });

  it('POST /prompts/:id/rollback — calls rollbackPrompt', async () => {
    await request(app).post('/api/v1/prompt-engine/prompts/abc-123/rollback').send({});
    expect(controller.rollbackPrompt).toHaveBeenCalled();
  });

  it('GET /prompts/:id/history — calls getPromptHistory', async () => {
    await request(app).get('/api/v1/prompt-engine/prompts/abc-123/history');
    expect(controller.getPromptHistory).toHaveBeenCalled();
  });

  it('POST /compose — calls compose', async () => {
    await request(app).post('/api/v1/prompt-engine/compose').send({});
    expect(controller.compose).toHaveBeenCalled();
  });

  it('GET /audit-logs — calls listAuditLogs', async () => {
    await request(app).get('/api/v1/prompt-engine/audit-logs');
    expect(controller.listAuditLogs).toHaveBeenCalled();
  });

  it('write endpoints check prompt.update permission', async () => {
    capturedPermissions.length = 0;
    await request(app).post('/api/v1/prompt-engine/prompts').send({});
    expect(capturedPermissions).toContain('prompt.update');
  });

  it('read endpoints check prompt.read permission', async () => {
    capturedPermissions.length = 0;
    await request(app).get('/api/v1/prompt-engine/prompts');
    expect(capturedPermissions).toContain('prompt.read');
  });

  it('audit-logs endpoint checks ai.config.read permission', async () => {
    capturedPermissions.length = 0;
    await request(app).get('/api/v1/prompt-engine/audit-logs');
    expect(capturedPermissions).toContain('ai.config.read');
  });
});

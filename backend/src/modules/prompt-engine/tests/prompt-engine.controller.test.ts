/**
 * Prompt Engine Controller — Unit Tests
 *
 * Tests HTTP request/response mapping, validation error handling,
 * tenant guard, and error handler middleware.
 */

import type { Request, Response, NextFunction } from 'express';
import { PromptEngineController, promptEngineErrorHandler } from '../controllers/prompt-engine.controller';
import type { IPromptEngineService, IPromptAuditLogRepository } from '../interfaces/prompt-engine.interfaces';
import type { SafePromptTemplate, ComposedPrompt } from '../types/prompt-engine.types';
import {
  PromptNotFoundError,
  PromptNotPublishableError,
  PromptValidationFailedError,
} from '../errors/prompt-engine.errors';
import { PROMPT_TYPE_SYSTEM } from '../constants/prompt-engine.constants';

// ---------------------------------------------------------------------------
// Helper builders
// ---------------------------------------------------------------------------

function mockReq(overrides: Partial<Request> = {}): Request {
  return {
    tenantId: 'tenant-1',
    requestId: 'req-1',
    user: { userId: 'user-1' },
    body: {},
    query: {},
    params: {},
    ...overrides,
  } as unknown as Request;
}

function mockRes(): Response {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    req: mockReq(),
  };
  return res as unknown as Response;
}

const UUID = '11111111-1111-1111-1111-111111111111';

function makeSafePrompt(): SafePromptTemplate {
  return {
    id: UUID,
    publicId: 'prmp_test',
    tenantId: 'tenant-1',
    clinicId: null,
    promptType: PROMPT_TYPE_SYSTEM,
    version: 1,
    status: 'draft',
    content: 'Clinic: {{clinic_name}}',
    variables: ['clinic_name'],
    hash: 'abc',
    changeSummary: null,
    authorId: 'user-1',
    publishedAt: null,
    previousVersionId: null,
    rollbackFromVersion: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

// ---------------------------------------------------------------------------
// Mock services
// ---------------------------------------------------------------------------

let mockService: jest.Mocked<IPromptEngineService>;
let mockAuditRepo: jest.Mocked<IPromptAuditLogRepository>;
let controller: PromptEngineController;

beforeEach(() => {
  mockService = {
    createPrompt:       jest.fn(),
    updatePrompt:       jest.fn(),
    publishPrompt:      jest.fn(),
    archivePrompt:      jest.fn(),
    rollbackPrompt:     jest.fn(),
    getPublishedPrompt: jest.fn(),
    getPromptById:      jest.fn(),
    listPrompts:        jest.fn(),
    getPromptHistory:   jest.fn(),
    composeSystemPrompt: jest.fn(),
  };

  mockAuditRepo = {
    create:   jest.fn(),
    findMany: jest.fn().mockResolvedValue([]),
  };

  controller = new PromptEngineController(mockService, mockAuditRepo);
});

// ---------------------------------------------------------------------------
// createPrompt
// ---------------------------------------------------------------------------

describe('POST /prompts — createPrompt', () => {
  it('returns 201 with prompt on success', async () => {
    const prompt = makeSafePrompt();
    mockService.createPrompt.mockResolvedValue(prompt);

    const req = mockReq({
      body: { clinicId: null, promptType: 'system', content: 'Hello clinic', variables: [] },
    });
    const res = mockRes();
    const next = jest.fn() as unknown as NextFunction;

    await controller.createPrompt(req, res, next);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, data: { prompt } }),
    );
  });

  it('returns 422 for invalid body', async () => {
    const req = mockReq({ body: { promptType: 'invalid_type', content: '' } });
    const res = mockRes();
    const next = jest.fn() as unknown as NextFunction;

    await controller.createPrompt(req, res, next);

    expect(res.status).toHaveBeenCalledWith(422);
  });

  it('returns 400 when tenantId is missing', async () => {
    const req = mockReq({ tenantId: undefined });
    const res = mockRes();
    const next = jest.fn() as unknown as NextFunction;

    await controller.createPrompt(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('calls next(err) on service error', async () => {
    mockService.createPrompt.mockRejectedValue(new Error('DB error'));
    const req = mockReq({ body: { clinicId: null, promptType: 'system', content: 'Hello', variables: [] } });
    const res = mockRes();
    const next = jest.fn() as unknown as NextFunction;

    await controller.createPrompt(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });
});

// ---------------------------------------------------------------------------
// publishPrompt
// ---------------------------------------------------------------------------

describe('POST /prompts/:id/publish — publishPrompt', () => {
  it('returns 200 on successful publish', async () => {
    const prompt = makeSafePrompt();
    mockService.publishPrompt.mockResolvedValue(prompt);

    const req = mockReq({ params: { id: UUID } });
    const res = mockRes();
    const next = jest.fn() as unknown as NextFunction;

    await controller.publishPrompt(req, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true }),
    );
  });
});

// ---------------------------------------------------------------------------
// compose
// ---------------------------------------------------------------------------

describe('POST /compose — compose', () => {
  it('returns 200 with ComposedPrompt', async () => {
    const composed: ComposedPrompt = {
      content: 'You are a dental receptionist.',
      promptType: PROMPT_TYPE_SYSTEM,
      promptId: null,
      promptVersion: null,
      characterCount: 32,
    };
    mockService.composeSystemPrompt.mockResolvedValue(composed);

    const req = mockReq({ body: { clinicId: null, variables: {} } });
    const res = mockRes();
    const next = jest.fn() as unknown as NextFunction;

    await controller.compose(req, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ data: { composed } }),
    );
  });
});

// ---------------------------------------------------------------------------
// listAuditLogs
// ---------------------------------------------------------------------------

describe('GET /audit-logs — listAuditLogs', () => {
  it('returns 200 with empty audit logs list', async () => {
    const req = mockReq({ query: {} });
    const res = mockRes();
    const next = jest.fn() as unknown as NextFunction;

    await controller.listAuditLogs(req, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ data: { auditLogs: [], total: 0 } }),
    );
  });
});

// ---------------------------------------------------------------------------
// promptEngineErrorHandler
// ---------------------------------------------------------------------------

describe('promptEngineErrorHandler', () => {
  it('handles PromptNotFoundError with 404', () => {
    const err = new PromptNotFoundError(UUID);
    const req = mockReq();
    const res = mockRes();
    const next = jest.fn() as unknown as NextFunction;

    promptEngineErrorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.objectContaining({ code: 'PROMPT_NOT_FOUND' }) }),
    );
  });

  it('handles PromptNotPublishableError with 422', () => {
    const err = new PromptNotPublishableError('published');
    const req = mockReq();
    const res = mockRes();
    const next = jest.fn() as unknown as NextFunction;

    promptEngineErrorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(422);
  });

  it('handles PromptValidationFailedError with 422 and error details', () => {
    const err = new PromptValidationFailedError([
      { code: 'UNKNOWN_VARIABLE', message: 'Unknown var' },
    ]);
    const req = mockReq();
    const res = mockRes();
    const next = jest.fn() as unknown as NextFunction;

    promptEngineErrorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(422);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ code: 'PROMPT_VALIDATION_FAILED' }),
      }),
    );
  });

  it('passes non-PromptEngineError to next()', () => {
    const err = new Error('Generic error');
    const req = mockReq();
    const res = mockRes();
    const next = jest.fn() as unknown as NextFunction;

    promptEngineErrorHandler(err, req, res, next);

    expect(next).toHaveBeenCalledWith(err);
    expect(res.status).not.toHaveBeenCalled();
  });
});

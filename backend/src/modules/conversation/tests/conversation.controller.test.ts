/**
 * Conversation Controller Unit Tests
 */

import type { Request, Response, NextFunction } from 'express';
import { ConversationController, conversationErrorHandler } from '../controllers/conversation.controller';
import {
  ConversationNotFoundError,
  ConversationIsolationViolationError,
} from '../errors/conversation.errors';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMockService() {
  return {
    createConversation: jest.fn(),
    updateConversation: jest.fn(),
    updateTranscript: jest.fn(),
    updateSummary: jest.fn(),
    linkRecording: jest.fn(),
    completeConversation: jest.fn(),
    failConversation: jest.fn(),
    archiveConversation: jest.fn(),
    softDeleteConversation: jest.fn(),
    getConversationById: jest.fn(),
    getConversationByPublicId: jest.fn(),
    listConversations: jest.fn(),
  };
}

function makeReq(overrides: Partial<Request> = {}): Request {
  return {
    body: {},
    params: {},
    query: {},
    headers: {},
    tenantId: '550e8400-e29b-41d4-a716-446655440000',
    requestId: 'req-1',
    user: { userId: 'actor-1' } as any,
    ...overrides,
  } as unknown as Request;
}

function makeRes(): { res: Response; status: jest.Mock; json: jest.Mock } {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const res = { status, req: { requestId: 'req-1' } } as unknown as Response;
  return { res, status, json };
}

const next: NextFunction = jest.fn();

const CONV_ID = '550e8400-e29b-41d4-a716-446655440004';
const TENANT_ID = '550e8400-e29b-41d4-a716-446655440000';

function makeConvResponse() {
  return {
    id: CONV_ID,
    publicId: 'conv_abc',
    tenantId: TENANT_ID,
    clinicId: 'c1',
    patientId: null,
    doctorId: null,
    appointmentId: null,
    callSessionId: 'session-123',
    callerPhone: '+1234567890',
    startedAt: new Date(),
    endedAt: null,
    durationSeconds: null,
    status: 'initiated',
    language: 'en',
    transcript: [],
    transcriptVersion: 0,
    summary: null,
    extractedEntities: null,
    intent: null,
    sentiment: null,
    recordingReference: null,
    recordingProvider: null,
    recordingStatus: null,
    inputTokens: null,
    outputTokens: null,
    totalTokens: null,
    estimatedCostUsd: null,
    aiModel: null,
    aiProvider: null,
    metadata: {},
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ConversationController', () => {
  let mockService: ReturnType<typeof makeMockService>;
  let controller: ConversationController;

  beforeEach(() => {
    jest.clearAllMocks();
    mockService = makeMockService();
    controller = new ConversationController(mockService as any);
  });

  describe('createConversation', () => {
    it('should return 201 on valid request', async () => {
      mockService.createConversation.mockResolvedValue(makeConvResponse());
      const { res } = makeRes();
      const req = makeReq({
        body: {
          clinicId: '550e8400-e29b-41d4-a716-446655440001',
          callSessionId: 'session-123',
          startedAt: '2025-01-01T09:00:00.000Z',
        },
      });

      await controller.createConversation(req, res, next);

      expect(res.status).toHaveBeenCalledWith(201);
    });

    it('should return 422 on validation failure', async () => {
      const { res } = makeRes();
      const req = makeReq({ body: {} });

      await controller.createConversation(req, res, next);

      expect(res.status).toHaveBeenCalledWith(422);
    });
  });

  describe('getConversation', () => {
    it('should return 200 with conversation details', async () => {
      mockService.getConversationById.mockResolvedValue(makeConvResponse());
      const { res } = makeRes();
      const req = makeReq({ params: { id: CONV_ID } });

      await controller.getConversation(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(mockService.getConversationById).toHaveBeenCalledWith(CONV_ID, TENANT_ID);
    });
  });

  describe('conversationErrorHandler', () => {
    it('should handle custom ConversationError with status code', () => {
      const err = new ConversationNotFoundError(CONV_ID);
      const { res, json } = makeRes();
      const req = { requestId: 'req-1' } as Request;

      conversationErrorHandler(err, req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({ code: 'CONVERSATION_NOT_FOUND' }),
        }),
      );
    });
  });
});

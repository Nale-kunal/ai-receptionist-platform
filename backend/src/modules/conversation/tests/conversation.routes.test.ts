/**
 * Conversation Routes Unit Tests
 */

import { Router } from 'express';
import type { RequestHandler } from 'express';
import { createConversationRouter } from '../routes/conversation.routes';
import type { ConversationController } from '../controllers/conversation.controller';

function makeNoop(): RequestHandler {
  return (_req, _res, next) => next();
}

function makeController(): ConversationController {
  return {
    createConversation: makeNoop(),
    listConversations: makeNoop(),
    getConversation: makeNoop(),
    getConversationByPublicId: makeNoop(),
    updateConversation: makeNoop(),
    updateTranscript: makeNoop(),
    updateSummary: makeNoop(),
    linkRecording: makeNoop(),
    completeConversation: makeNoop(),
    failConversation: makeNoop(),
    archiveConversation: makeNoop(),
    deleteConversation: makeNoop(),
  } as unknown as ConversationController;
}

describe('createConversationRouter', () => {
  it('should return an Express Router instance', () => {
    const router = createConversationRouter({
      controller: makeController(),
      authenticate: makeNoop(),
      resolveTenant: makeNoop(),
      authorize: { requirePermission: () => makeNoop() },
    });

    expect(router).toBeDefined();
    expect(typeof router).toBe('function');
  });

  it('should register at least 12 route handlers', () => {
    const router = createConversationRouter({
      controller: makeController(),
      authenticate: makeNoop(),
      resolveTenant: makeNoop(),
      authorize: { requirePermission: () => makeNoop() },
    }) as unknown as { stack: unknown[] };

    expect(router.stack.length).toBeGreaterThanOrEqual(12);
  });
});

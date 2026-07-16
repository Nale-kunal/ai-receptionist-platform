/**
 * Conversation Routes
 *
 * Defines REST endpoints for the Conversation lifecycle.
 * Protects all paths using Authentication, Tenant resolution, and RBAC permission checks.
 */

import { Router } from 'express';
import type { RequestHandler } from 'express';
import type { ConversationController } from '../controllers/conversation.controller';
import {
  PERM_CONVERSATION_READ,
  PERM_CONVERSATION_SUMMARY,
  PERM_CONVERSATION_DELETE,
} from '../../rbac/constants/rbac.constants';

export interface AuthorizeMiddleware {
  requirePermission(permission: string): RequestHandler;
}

export interface ConversationRouterDeps {
  controller: ConversationController;
  authenticate: RequestHandler;
  resolveTenant: RequestHandler;
  authorize: AuthorizeMiddleware;
}

export function createConversationRouter(deps: ConversationRouterDeps): Router {
  const { controller, authenticate, resolveTenant, authorize } = deps;
  const router = Router();

  const requireRead    = authorize.requirePermission(PERM_CONVERSATION_READ);
  const requireSummary = authorize.requirePermission(PERM_CONVERSATION_SUMMARY);
  const requireDelete  = authorize.requirePermission(PERM_CONVERSATION_DELETE);

  // 1. List conversations
  router.get('/',
    authenticate,
    resolveTenant,
    requireRead,
    controller.listConversations,
  );

  // 2. Create conversation (started)
  router.post('/',
    authenticate,
    resolveTenant,
    requireRead,
    controller.createConversation,
  );

  // 3. Get conversation by public ID (must come before /:id to avoid shadowing)
  router.get('/public/:publicId',
    authenticate,
    resolveTenant,
    requireRead,
    controller.getConversationByPublicId,
  );

  // 4. Get conversation by internal ID
  router.get('/:id',
    authenticate,
    resolveTenant,
    requireRead,
    controller.getConversation,
  );

  // 5. Update conversation (general metadata, tokens, intent, sentiment, etc.)
  router.patch('/:id',
    authenticate,
    resolveTenant,
    requireRead,
    controller.updateConversation,
  );

  // 6. Append/update transcript
  router.post('/:id/transcript',
    authenticate,
    resolveTenant,
    requireRead,
    controller.updateTranscript,
  );

  // 7. Generate/update AI summary
  router.post('/:id/summary',
    authenticate,
    resolveTenant,
    requireSummary,
    controller.updateSummary,
  );

  // 8. Link recording reference
  router.post('/:id/recording',
    authenticate,
    resolveTenant,
    requireRead,
    controller.linkRecording,
  );

  // 9. Complete conversation
  router.post('/:id/complete',
    authenticate,
    resolveTenant,
    requireRead,
    controller.completeConversation,
  );

  // 10. Fail conversation
  router.post('/:id/fail',
    authenticate,
    resolveTenant,
    requireRead,
    controller.failConversation,
  );

  // 11. Archive conversation
  router.post('/:id/archive',
    authenticate,
    resolveTenant,
    requireRead,
    controller.archiveConversation,
  );

  // 12. Soft delete conversation
  router.delete('/:id',
    authenticate,
    resolveTenant,
    requireDelete,
    controller.deleteConversation,
  );

  return router;
}

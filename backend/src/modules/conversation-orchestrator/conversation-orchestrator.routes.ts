import { Router } from 'express';
import { ConversationOrchestratorController } from './conversation-orchestrator.controller';
import type { IConversationOrchestrator } from './conversation-orchestrator.interfaces';

export function createConversationOrchestratorRoutes(
  orchestratorService: IConversationOrchestrator
): Router {
  const router = Router();
  const controller = new ConversationOrchestratorController(orchestratorService);

  router.post('/', controller.createSession);
  router.get('/', controller.listActiveSessions);
  router.get('/:id', controller.getSession);
  router.patch('/:id/state', controller.updateSessionState);

  return router;
}

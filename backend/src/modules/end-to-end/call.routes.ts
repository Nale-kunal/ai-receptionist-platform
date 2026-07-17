/**
 * End-to-End Call Flow — Express Routes
 */

import { Router } from 'express';
import type { RequestHandler } from 'express';
import type { CallController } from './call.controller';

export function createCallRoutes(controller: CallController): Router {
  const router = Router();

  // Route to trigger E2E call flow initialization (inbound setup callback)
  router.post(
    '/calls',
    controller.startCall as unknown as RequestHandler,
  );

  // Route to trigger call hangup/completion
  router.delete(
    '/calls/:sessionId',
    controller.endCall as unknown as RequestHandler,
  );

  return router;
}

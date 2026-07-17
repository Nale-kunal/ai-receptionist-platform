/**
 * End-to-End Call Flow — Express Controller
 */

import type { Request, Response, NextFunction } from 'express';
import { validateIncomingCallPayload } from './call.validators';
import type { CallFlowCoordinator } from './call-flow.coordinator';
import { E2eSecurityValidationError } from './end-to-end.errors';

export class CallController {
  constructor(private readonly coordinator: CallFlowCoordinator) {}

  public startCall = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      // Validate request payload structure
      validateIncomingCallPayload(req.body);

      const session = await this.coordinator.initializeCall({
        tenantId: req.body.tenantId,
        callerNumber: req.body.callerNumber,
        calledNumber: req.body.calledNumber,
        callSid: req.body.callSid,
      });

      res.status(201).json({
        status: 'success',
        sessionId: session.sessionId,
        currentState: session.currentState,
      });
    } catch (err) {
      if (err instanceof E2eSecurityValidationError) {
        res.status(400).json({ error: err.message, code: err.code });
        return;
      }
      next(err);
    }
  };

  public endCall = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { sessionId } = req.params;
      if (!sessionId) {
        throw new E2eSecurityValidationError('Missing sessionId parameter.');
      }

      await this.coordinator.handleHangup(sessionId);

      res.status(200).json({
        status: 'success',
        message: `Call session '${sessionId}' ended successfully.`,
      });
    } catch (err) {
      if (err instanceof E2eSecurityValidationError) {
        res.status(400).json({ error: err.message, code: err.code });
        return;
      }
      next(err);
    }
  };
}

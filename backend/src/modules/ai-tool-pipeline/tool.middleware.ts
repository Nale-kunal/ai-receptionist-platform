import type { Request, Response, NextFunction } from 'express';
import type { ExecutionContext } from './ai-tool.types';

export function createToolContextMiddleware() {
  return (req: Request, res: Response, next: NextFunction): void => {
    const tenantId = req.headers['x-tenant-id'] as string;
    const clinicId = req.headers['x-clinic-id'] as string || null;
    const sessionId = req.headers['x-session-id'] as string || `ses_${Math.random().toString(36).substring(2, 10)}`;
    const conversationId = req.headers['x-conversation-id'] as string || `conv_${Math.random().toString(36).substring(2, 10)}`;
    const patientId = req.headers['x-patient-id'] as string || null;
    const userId = req.headers['x-user-id'] as string || null;
    const correlationId = req.headers['x-correlation-id'] as string || `corr_${Math.random().toString(36).substring(2, 10)}`;
    const traceId = req.headers['x-trace-id'] as string || `trace_${Math.random().toString(36).substring(2, 10)}`;
    const provider = req.headers['x-provider'] as string || 'default';
    const toolVersion = req.body?.version || '1.0.0';

    const context: ExecutionContext = {
      correlationId,
      traceId,
      tenantId,
      clinicId,
      sessionId,
      conversationId,
      patientId,
      userId,
      provider,
      toolVersion,
      timestamp: new Date(),
    };

    // Attach immutable context to Express request
    (req as any).toolContext = context;
    next();
  };
}

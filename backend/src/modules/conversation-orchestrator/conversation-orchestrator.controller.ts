import type { Request, Response, NextFunction } from 'express';
import type { IConversationOrchestrator } from './conversation-orchestrator.interfaces';
import { OrchestratorSecurityValidator } from './conversation-orchestrator.security.validator';
import { ConversationSessionCreateSchema, ConversationContextSyncSchema } from './conversation-orchestrator.validators';

export class ConversationOrchestratorController {
  private readonly securityValidator: OrchestratorSecurityValidator;

  constructor(
    private readonly orchestratorService: IConversationOrchestrator
  ) {
    this.securityValidator = new OrchestratorSecurityValidator({
      allowedOrigins: ['http://localhost:3000', 'https://receptionist.ai'],
    });
  }

  public createSession = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = req.headers['x-tenant-id'] as string;
      if (!tenantId) {
        res.status(400).json({ success: false, error: 'x-tenant-id header is required.' });
        return;
      }

      // Check rate limit bounds
      if (!this.orchestratorService.rateLimitCheck(tenantId)) {
        res.status(429).json({ success: false, error: 'Rate limit exceeded for conversations.' });
        return;
      }

      const body = ConversationSessionCreateSchema.parse(req.body);

      const correlationId = (req.headers['x-correlation-id'] as string) ?? `corr_${Math.random().toString(36).substring(2, 10)}`;
      const traceId = (req.headers['x-trace-id'] as string) ?? `trace_${Math.random().toString(36).substring(2, 10)}`;

      const session = await this.orchestratorService.createSession({
        tenantId,
        clinicId: body.clinicId,
        conversationId: body.conversationId,
        correlation: {
          correlationId,
          traceId,
          tenantId,
          sessionId: '', // filled dynamically in publisher
          conversationId: body.conversationId,
          timestamp: new Date(),
        },
      });

      res.status(201).json({ success: true, data: { session } });
    } catch (err) {
      next(err);
    }
  };

  public getSession = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = req.headers['x-tenant-id'] as string;
      const { id } = req.params;

      if (!tenantId || !id) {
        res.status(400).json({ success: false, error: 'Session ID and x-tenant-id are required.' });
        return;
      }

      const session = await this.orchestratorService.getSession(id, tenantId);
      
      // Security Validation check
      this.securityValidator.validateTenantContext(session.tenantId, tenantId);

      res.status(200).json({ success: true, data: { session } });
    } catch (err) {
      next(err);
    }
  };

  public updateSessionState = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = req.headers['x-tenant-id'] as string;
      const { id } = req.params;
      const { state } = req.body;

      if (!tenantId || !id || !state) {
        res.status(400).json({ success: false, error: 'Session ID, state, and x-tenant-id are required.' });
        return;
      }

      const currentSession = await this.orchestratorService.getSession(id, tenantId);
      this.securityValidator.validateTenantContext(currentSession.tenantId, tenantId);

      const correlationId = (req.headers['x-correlation-id'] as string) ?? `corr_${Math.random().toString(36).substring(2, 10)}`;
      const traceId = (req.headers['x-trace-id'] as string) ?? `trace_${Math.random().toString(36).substring(2, 10)}`;

      const session = await this.orchestratorService.updateState(id, tenantId, state, {
        correlationId,
        traceId,
        tenantId,
        sessionId: id,
        conversationId: currentSession.conversationId,
        timestamp: new Date(),
      });

      res.status(200).json({ success: true, data: { session } });
    } catch (err) {
      next(err);
    }
  };

  public listActiveSessions = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = req.headers['x-tenant-id'] as string;
      if (!tenantId) {
        res.status(400).json({ success: false, error: 'x-tenant-id is required.' });
        return;
      }

      const sessions = await this.orchestratorService.listActiveSessions(tenantId);
      res.status(200).json({ success: true, data: { sessions } });
    } catch (err) {
      next(err);
    }
  };
}

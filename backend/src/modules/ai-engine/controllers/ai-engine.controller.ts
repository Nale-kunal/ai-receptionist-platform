/**
 * AI Engine Controller
 *
 * Maps Express requests/responses to AiEngineService methods.
 */

import type { Request, Response, NextFunction } from 'express';
import type { IAiEngineService, IAiAuditLogRepository } from '../interfaces/ai-engine.interfaces';
import { ChatRequestSchema, ParseRequestSchema, ListAuditLogsSchema } from '../validators/ai-engine.validators';
import { AiEngineError } from '../errors/ai-engine.errors';
import { ZodError } from 'zod';

function sendSuccess(res: Response, data: unknown, statusCode = 200): void {
  res.status(statusCode).json({
    success: true,
    data,
    requestId: (res.req as Request).requestId ?? '',
    timestamp: new Date().toISOString(),
  });
}

function sendValidationError(res: Response, error: ZodError, requestId: string): void {
  res.status(422).json({
    success: false,
    error: {
      code: 'VALIDATION_FAILED',
      message: 'Validation failed.',
      details: error.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      })),
    },
    requestId,
    timestamp: new Date().toISOString(),
  });
}

export class AiEngineController {
  constructor(
    private readonly aiEngineService: IAiEngineService,
    private readonly auditLogRepository: IAiAuditLogRepository,
  ) {}

  /** POST /api/v1/ai-engine/chat */
  public chat = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = req.tenantId;
      if (!tenantId) {
        res.status(400).json({
          success: false,
          error: { code: 'MISSING_TENANT_CONTEXT', message: 'Tenant context is missing.' },
        });
        return;
      }
      const requestId = req.requestId ?? '';
      const parsed = ChatRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        sendValidationError(res, parsed.error, requestId);
        return;
      }

      const actorId = req.user?.userId ?? 'system';
      const response = await this.aiEngineService.chat({
        tenantId,
        clinicId: parsed.data.clinicId,
        conversationId: parsed.data.conversationId,
        message: parsed.data.message,
        actorId,
        requestId,
      });

      sendSuccess(res, { response });
    } catch (err) {
      next(err);
    }
  };

  /** POST /api/v1/ai-engine/parse */
  public parse = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = req.tenantId;
      if (!tenantId) {
        res.status(400).json({
          success: false,
          error: { code: 'MISSING_TENANT_CONTEXT', message: 'Tenant context is missing.' },
        });
        return;
      }
      const requestId = req.requestId ?? '';
      const parsed = ParseRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        sendValidationError(res, parsed.error, requestId);
        return;
      }

      const parseResult = await this.aiEngineService.parse({
        tenantId,
        clinicId: parsed.data.clinicId,
        message: parsed.data.message,
        requestId,
      });

      sendSuccess(res, { parseResult });
    } catch (err) {
      next(err);
    }
  };

  /** GET /api/v1/ai-engine/audit-logs */
  public listAuditLogs = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = req.tenantId;
      if (!tenantId) {
        res.status(400).json({
          success: false,
          error: { code: 'MISSING_TENANT_CONTEXT', message: 'Tenant context is missing.' },
        });
        return;
      }
      const parsed = ListAuditLogsSchema.safeParse(req.query);
      if (!parsed.success) {
        sendValidationError(res, parsed.error, req.requestId ?? '');
        return;
      }

      const auditLogs = await this.auditLogRepository.findMany({
        tenantId,
        clinicId: parsed.data.clinicId,
        conversationId: parsed.data.conversationId,
        limit: parsed.data.limit,
        offset: parsed.data.offset,
      });

      sendSuccess(res, { auditLogs, total: auditLogs.length });
    } catch (err) {
      next(err);
    }
  };
}

/**
 * AI Engine module-level Error Handler
 */
export function aiEngineErrorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (err instanceof AiEngineError) {
    res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        details: err.details ? [err.details] : [],
      },
      requestId: req.requestId ?? '',
      timestamp: new Date().toISOString(),
    });
    return;
  }
  next(err);
}

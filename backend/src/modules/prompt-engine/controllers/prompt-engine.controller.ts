/**
 * Prompt Engine Controller
 *
 * Maps Express HTTP requests to PromptEngineService methods.
 * All endpoints require an authenticated, tenant-resolved context.
 */

import type { Request, Response, NextFunction } from 'express';
import type { IPromptEngineService, IPromptAuditLogRepository } from '../interfaces/prompt-engine.interfaces';
import {
  CreatePromptSchema,
  UpdatePromptSchema,
  RollbackPromptSchema,
  ListPromptsSchema,
  ListPromptAuditLogsSchema,
  ComposeSchema,
} from '../validators/prompt-engine.validators';
import { PromptEngineError } from '../errors/prompt-engine.errors';
import { ZodError } from 'zod';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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
        field:   e.path.join('.'),
        message: e.message,
      })),
    },
    requestId,
    timestamp: new Date().toISOString(),
  });
}

function requireTenant(req: Request, res: Response): string | null {
  const tenantId = req.tenantId;
  if (!tenantId) {
    res.status(400).json({
      success: false,
      error: { code: 'MISSING_TENANT_CONTEXT', message: 'Tenant context is missing.' },
    });
    return null;
  }
  return tenantId;
}

// ---------------------------------------------------------------------------
// Controller Class
// ---------------------------------------------------------------------------

export class PromptEngineController {
  constructor(
    private readonly promptService: IPromptEngineService,
    private readonly auditRepo: IPromptAuditLogRepository,
  ) {}

  /** POST /api/v1/prompt-engine/prompts */
  public createPrompt = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = requireTenant(req, res);
      if (!tenantId) return;

      const requestId = req.requestId ?? '';
      const parsed = CreatePromptSchema.safeParse(req.body);
      if (!parsed.success) { sendValidationError(res, parsed.error, requestId); return; }

      const authorId = req.user?.userId ?? 'system';
      const prompt = await this.promptService.createPrompt({
        tenantId,
        clinicId:     parsed.data.clinicId,
        promptType:   parsed.data.promptType as any,
        content:      parsed.data.content,
        variables:    parsed.data.variables,
        changeSummary: parsed.data.changeSummary,
        authorId,
        requestId,
      });
      sendSuccess(res, { prompt }, 201);
    } catch (err) {
      next(err);
    }
  };

  /** GET /api/v1/prompt-engine/prompts */
  public listPrompts = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = requireTenant(req, res);
      if (!tenantId) return;

      const parsed = ListPromptsSchema.safeParse(req.query);
      if (!parsed.success) { sendValidationError(res, parsed.error, req.requestId ?? ''); return; }

      const prompts = await this.promptService.listPrompts({
        tenantId,
        clinicId:   parsed.data.clinicId,
        promptType: parsed.data.promptType as any,
        status:     parsed.data.status as any,
        limit:      parsed.data.limit,
        offset:     parsed.data.offset,
      });
      sendSuccess(res, { prompts, total: prompts.length });
    } catch (err) {
      next(err);
    }
  };

  /** GET /api/v1/prompt-engine/prompts/:id */
  public getPrompt = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = requireTenant(req, res);
      if (!tenantId) return;

      const prompt = await this.promptService.getPromptById(req.params.id!, tenantId);
      sendSuccess(res, { prompt });
    } catch (err) {
      next(err);
    }
  };

  /** PATCH /api/v1/prompt-engine/prompts/:id */
  public updatePrompt = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = requireTenant(req, res);
      if (!tenantId) return;

      const requestId = req.requestId ?? '';
      const parsed = UpdatePromptSchema.safeParse(req.body);
      if (!parsed.success) { sendValidationError(res, parsed.error, requestId); return; }

      const prompt = await this.promptService.updatePrompt({
        id: req.params.id!,
        tenantId,
        content:      parsed.data.content,
        variables:    parsed.data.variables,
        changeSummary: parsed.data.changeSummary,
        actorId:  req.user?.userId ?? 'system',
        requestId,
      });
      sendSuccess(res, { prompt });
    } catch (err) {
      next(err);
    }
  };

  /** POST /api/v1/prompt-engine/prompts/:id/publish */
  public publishPrompt = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = requireTenant(req, res);
      if (!tenantId) return;

      const prompt = await this.promptService.publishPrompt(
        req.params.id!,
        tenantId,
        req.user?.userId ?? 'system',
        req.requestId ?? '',
      );
      sendSuccess(res, { prompt });
    } catch (err) {
      next(err);
    }
  };

  /** POST /api/v1/prompt-engine/prompts/:id/archive */
  public archivePrompt = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = requireTenant(req, res);
      if (!tenantId) return;

      const prompt = await this.promptService.archivePrompt(
        req.params.id!,
        tenantId,
        req.user?.userId ?? 'system',
        req.requestId ?? '',
      );
      sendSuccess(res, { prompt });
    } catch (err) {
      next(err);
    }
  };

  /** POST /api/v1/prompt-engine/prompts/:id/rollback */
  public rollbackPrompt = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = requireTenant(req, res);
      if (!tenantId) return;

      const requestId = req.requestId ?? '';
      const parsed = RollbackPromptSchema.safeParse(req.body);
      if (!parsed.success) { sendValidationError(res, parsed.error, requestId); return; }

      const prompt = await this.promptService.rollbackPrompt({
        targetVersionId: parsed.data.targetVersionId,
        tenantId,
        actorId:   req.user?.userId ?? 'system',
        requestId,
      });
      sendSuccess(res, { prompt });
    } catch (err) {
      next(err);
    }
  };

  /** GET /api/v1/prompt-engine/prompts/:id/history */
  public getPromptHistory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = requireTenant(req, res);
      if (!tenantId) return;

      const history = await this.promptService.getPromptHistory(req.params.id!, tenantId);
      sendSuccess(res, { history });
    } catch (err) {
      next(err);
    }
  };

  /** POST /api/v1/prompt-engine/compose */
  public compose = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = requireTenant(req, res);
      if (!tenantId) return;

      const requestId = req.requestId ?? '';
      const parsed = ComposeSchema.safeParse(req.body);
      if (!parsed.success) { sendValidationError(res, parsed.error, requestId); return; }

      const composed = await this.promptService.composeSystemPrompt({
        tenantId,
        clinicId:            parsed.data.clinicId,
        variables:           parsed.data.variables as any,
        conversationContext: parsed.data.conversationContext,
        requestId,
      });
      sendSuccess(res, { composed });
    } catch (err) {
      next(err);
    }
  };

  /** GET /api/v1/prompt-engine/audit-logs */
  public listAuditLogs = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = requireTenant(req, res);
      if (!tenantId) return;

      const parsed = ListPromptAuditLogsSchema.safeParse(req.query);
      if (!parsed.success) { sendValidationError(res, parsed.error, req.requestId ?? ''); return; }

      const auditLogs = await this.auditRepo.findMany({
        tenantId,
        clinicId: parsed.data.clinicId,
        promptId: parsed.data.promptId,
        limit:    parsed.data.limit,
        offset:   parsed.data.offset,
      });
      sendSuccess(res, { auditLogs, total: auditLogs.length });
    } catch (err) {
      next(err);
    }
  };
}

// ---------------------------------------------------------------------------
// Module-level Error Handler
// ---------------------------------------------------------------------------

export function promptEngineErrorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (err instanceof PromptEngineError) {
    res.status(err.statusCode).json({
      success: false,
      error: {
        code:    err.code,
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

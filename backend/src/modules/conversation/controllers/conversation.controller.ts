/**
 * Conversation Controller
 *
 * Maps Express request/response to ConversationService methods.
 * Contains no business logic — delegates entirely to the service.
 */

import type { Request, Response, NextFunction } from 'express';
import type { IConversationService } from '../interfaces/conversation.interfaces';
import { CreateConversationSchema } from '../validators/create-conversation.validator';
import { UpdateConversationSchema } from '../validators/update-conversation.validator';
import { UpdateTranscriptSchema } from '../validators/update-transcript.validator';
import { UpdateSummarySchema } from '../validators/update-summary.validator';
import { LinkRecordingSchema } from '../validators/link-recording.validator';
import { ListConversationsSchema } from '../validators/list-conversations.validator';
import { ConversationError } from '../errors/conversation.errors';
import { ZodError } from 'zod';

// ---------------------------------------------------------------------------
// Response Helpers
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
        field: e.path.join('.'),
        message: e.message,
      })),
    },
    requestId,
    timestamp: new Date().toISOString(),
  });
}

// ---------------------------------------------------------------------------
// Controller
// ---------------------------------------------------------------------------

export class ConversationController {
  constructor(private readonly conversationService: IConversationService) {}

  /** POST /api/v1/conversations */
  public createConversation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = req.tenantId;
      if (!tenantId) {
        res.status(400).json({ success: false, error: { code: 'MISSING_TENANT_CONTEXT', message: 'Tenant context is missing.' } });
        return;
      }
      const requestId = req.requestId ?? '';
      const parsed = CreateConversationSchema.safeParse(req.body);
      if (!parsed.success) {
        sendValidationError(res, parsed.error, requestId);
        return;
      }

      const actorId = req.user?.userId ?? 'system';
      const conversation = await this.conversationService.createConversation({
        tenantId,
        clinicId: parsed.data.clinicId,
        patientId: parsed.data.patientId,
        doctorId: parsed.data.doctorId,
        appointmentId: parsed.data.appointmentId,
        callSessionId: parsed.data.callSessionId,
        callerPhone: parsed.data.callerPhone,
        startedAt: new Date(parsed.data.startedAt),
        language: parsed.data.language,
        metadata: parsed.data.metadata,
        actorId,
        requestId,
      });

      sendSuccess(res, { conversation }, 201);
    } catch (err) {
      next(err);
    }
  };

  /** GET /api/v1/conversations */
  public listConversations = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = req.tenantId;
      if (!tenantId) {
        res.status(400).json({ success: false, error: { code: 'MISSING_TENANT_CONTEXT', message: 'Tenant context is missing.' } });
        return;
      }
      const parsed = ListConversationsSchema.safeParse(req.query);
      if (!parsed.success) {
        sendValidationError(res, parsed.error, req.requestId ?? '');
        return;
      }

      const { startedFrom, startedTo, ...rest } = parsed.data;
      const conversations = await this.conversationService.listConversations({
        tenantId,
        ...rest,
        startedFrom: startedFrom ? new Date(startedFrom) : undefined,
        startedTo: startedTo ? new Date(startedTo) : undefined,
      });

      sendSuccess(res, { conversations, total: conversations.length });
    } catch (err) {
      next(err);
    }
  };

  /** GET /api/v1/conversations/:id */
  public getConversation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = req.tenantId;
      if (!tenantId) {
        res.status(400).json({ success: false, error: { code: 'MISSING_TENANT_CONTEXT', message: 'Tenant context is missing.' } });
        return;
      }
      const { id } = req.params as { id: string };
      const conversation = await this.conversationService.getConversationById(id, tenantId);
      sendSuccess(res, { conversation });
    } catch (err) {
      next(err);
    }
  };

  /** GET /api/v1/conversations/public/:publicId */
  public getConversationByPublicId = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = req.tenantId;
      if (!tenantId) {
        res.status(400).json({ success: false, error: { code: 'MISSING_TENANT_CONTEXT', message: 'Tenant context is missing.' } });
        return;
      }
      const { publicId } = req.params as { publicId: string };
      const conversation = await this.conversationService.getConversationByPublicId(publicId, tenantId);
      sendSuccess(res, { conversation });
    } catch (err) {
      next(err);
    }
  };

  /** PATCH /api/v1/conversations/:id */
  public updateConversation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = req.tenantId;
      if (!tenantId) {
        res.status(400).json({ success: false, error: { code: 'MISSING_TENANT_CONTEXT', message: 'Tenant context is missing.' } });
        return;
      }
      const requestId = req.requestId ?? '';
      const { id } = req.params as { id: string };

      const parsed = UpdateConversationSchema.safeParse(req.body);
      if (!parsed.success) {
        sendValidationError(res, parsed.error, requestId);
        return;
      }

      const actorId = req.user?.userId ?? 'system';
      const conversation = await this.conversationService.updateConversation({
        id,
        tenantId,
        ...parsed.data,
        actorId,
        requestId,
      });

      sendSuccess(res, { conversation });
    } catch (err) {
      next(err);
    }
  };

  /** POST /api/v1/conversations/:id/transcript */
  public updateTranscript = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = req.tenantId;
      if (!tenantId) {
        res.status(400).json({ success: false, error: { code: 'MISSING_TENANT_CONTEXT', message: 'Tenant context is missing.' } });
        return;
      }
      const requestId = req.requestId ?? '';
      const { id } = req.params as { id: string };

      const parsed = UpdateTranscriptSchema.safeParse(req.body);
      if (!parsed.success) {
        sendValidationError(res, parsed.error, requestId);
        return;
      }

      const actorId = req.user?.userId ?? 'system';
      const conversation = await this.conversationService.updateTranscript({
        id,
        tenantId,
        turns: parsed.data.turns,
        actorId,
        requestId,
      });

      sendSuccess(res, { conversation });
    } catch (err) {
      next(err);
    }
  };

  /** POST /api/v1/conversations/:id/summary */
  public updateSummary = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = req.tenantId;
      if (!tenantId) {
        res.status(400).json({ success: false, error: { code: 'MISSING_TENANT_CONTEXT', message: 'Tenant context is missing.' } });
        return;
      }
      const requestId = req.requestId ?? '';
      const { id } = req.params as { id: string };

      const parsed = UpdateSummarySchema.safeParse(req.body);
      if (!parsed.success) {
        sendValidationError(res, parsed.error, requestId);
        return;
      }

      const actorId = req.user?.userId ?? 'system';
      const conversation = await this.conversationService.updateSummary({
        id,
        tenantId,
        summary: parsed.data.summary,
        actorId,
        requestId,
      });

      sendSuccess(res, { conversation });
    } catch (err) {
      next(err);
    }
  };

  /** POST /api/v1/conversations/:id/recording */
  public linkRecording = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = req.tenantId;
      if (!tenantId) {
        res.status(400).json({ success: false, error: { code: 'MISSING_TENANT_CONTEXT', message: 'Tenant context is missing.' } });
        return;
      }
      const requestId = req.requestId ?? '';
      const { id } = req.params as { id: string };

      const parsed = LinkRecordingSchema.safeParse(req.body);
      if (!parsed.success) {
        sendValidationError(res, parsed.error, requestId);
        return;
      }

      const actorId = req.user?.userId ?? 'system';
      const conversation = await this.conversationService.linkRecording({
        id,
        tenantId,
        recordingReference: parsed.data.recordingReference,
        recordingProvider: parsed.data.recordingProvider,
        recordingStatus: parsed.data.recordingStatus,
        actorId,
        requestId,
      });

      sendSuccess(res, { conversation });
    } catch (err) {
      next(err);
    }
  };

  /** POST /api/v1/conversations/:id/complete */
  public completeConversation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = req.tenantId;
      if (!tenantId) {
        res.status(400).json({ success: false, error: { code: 'MISSING_TENANT_CONTEXT', message: 'Tenant context is missing.' } });
        return;
      }
      const requestId = req.requestId ?? '';
      const { id } = req.params as { id: string };

      const actorId = req.user?.userId ?? 'system';
      const conversation = await this.conversationService.completeConversation({
        id,
        tenantId,
        actorId,
        requestId,
      });

      sendSuccess(res, { conversation });
    } catch (err) {
      next(err);
    }
  };

  /** POST /api/v1/conversations/:id/fail */
  public failConversation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = req.tenantId;
      if (!tenantId) {
        res.status(400).json({ success: false, error: { code: 'MISSING_TENANT_CONTEXT', message: 'Tenant context is missing.' } });
        return;
      }
      const requestId = req.requestId ?? '';
      const { id } = req.params as { id: string };

      const actorId = req.user?.userId ?? 'system';
      const conversation = await this.conversationService.failConversation(id, tenantId, actorId, requestId);

      sendSuccess(res, { conversation });
    } catch (err) {
      next(err);
    }
  };

  /** POST /api/v1/conversations/:id/archive */
  public archiveConversation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = req.tenantId;
      if (!tenantId) {
        res.status(400).json({ success: false, error: { code: 'MISSING_TENANT_CONTEXT', message: 'Tenant context is missing.' } });
        return;
      }
      const requestId = req.requestId ?? '';
      const { id } = req.params as { id: string };

      const actorId = req.user?.userId ?? 'system';
      const conversation = await this.conversationService.archiveConversation(id, tenantId, actorId, requestId);

      sendSuccess(res, { conversation });
    } catch (err) {
      next(err);
    }
  };

  /** DELETE /api/v1/conversations/:id */
  public deleteConversation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = req.tenantId;
      if (!tenantId) {
        res.status(400).json({ success: false, error: { code: 'MISSING_TENANT_CONTEXT', message: 'Tenant context is missing.' } });
        return;
      }
      const requestId = req.requestId ?? '';
      const { id } = req.params as { id: string };

      const actorId = req.user?.userId ?? 'system';
      await this.conversationService.softDeleteConversation(id, tenantId, actorId, requestId);

      sendSuccess(res, { success: true });
    } catch (err) {
      next(err);
    }
  };
}

// ---------------------------------------------------------------------------
// Module-level Error Handler
// ---------------------------------------------------------------------------

export function conversationErrorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (err instanceof ConversationError) {
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

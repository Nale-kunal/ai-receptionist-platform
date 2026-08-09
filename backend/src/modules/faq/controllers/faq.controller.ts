import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import type { IFaqService } from '../interfaces/faq.interfaces';

// --------------------------------------------------------------------------
// Validation Schemas
// --------------------------------------------------------------------------

export const CreateFaqSchema = z.object({
  question: z.string().min(1, 'Question is required.'),
  answer: z.string().min(1, 'Answer is required.'),
});

export const UpdateFaqSchema = z.object({
  question: z.string().min(1).optional(),
  answer: z.string().min(1).optional(),
});

export const ListFaqsQuerySchema = z.object({
  limit: z.preprocess(
    (val) => (val ? parseInt(val as string, 10) : undefined),
    z.number().int().min(1).max(100).default(20),
  ),
  offset: z.preprocess(
    (val) => (val ? parseInt(val as string, 10) : undefined),
    z.number().int().min(0).default(0),
  ),
});

// --------------------------------------------------------------------------
// Controller
// --------------------------------------------------------------------------

export class FaqController {
  constructor(private readonly service: IFaqService) {}

  public create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = req.tenantId;
      if (!tenantId) {
        res.status(400).json({ success: false, error: { code: 'MISSING_TENANT_CONTEXT', message: 'Tenant context is missing.' } });
        return;
      }

      const parsed = CreateFaqSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(422).json({
          success: false,
          error: {
            code: 'VALIDATION_FAILED',
            message: 'Request validation failed.',
            details: parsed.error.errors.map((e) => ({ field: e.path.join('.'), message: e.message })),
          },
        });
        return;
      }

      const actorId = req.user?.userId ?? 'system';
      const requestId = req.requestId ?? '';

      const faq = await this.service.createFaq({
        tenantId,
        question: parsed.data.question,
        answer: parsed.data.answer,
        actorId,
        requestId,
      });

      res.status(201).json({ success: true, data: faq });
    } catch (err) {
      next(err);
    }
  };

  public update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = req.tenantId;
      if (!tenantId) {
        res.status(400).json({ success: false, error: { code: 'MISSING_TENANT_CONTEXT', message: 'Tenant context is missing.' } });
        return;
      }

      const parsed = UpdateFaqSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(422).json({
          success: false,
          error: {
            code: 'VALIDATION_FAILED',
            message: 'Request validation failed.',
            details: parsed.error.errors.map((e) => ({ field: e.path.join('.'), message: e.message })),
          },
        });
        return;
      }

      const actorId = req.user?.userId ?? 'system';
      const requestId = req.requestId ?? '';

      const faq = await this.service.updateFaq({
        id: req.params['id']!,
        tenantId,
        question: parsed.data.question,
        answer: parsed.data.answer,
        actorId,
        requestId,
      });

      res.status(200).json({ success: true, data: faq });
    } catch (err) {
      next(err);
    }
  };

  public get = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = req.tenantId;
      if (!tenantId) {
        res.status(400).json({ success: false, error: { code: 'MISSING_TENANT_CONTEXT', message: 'Tenant context is missing.' } });
        return;
      }

      const faq = await this.service.getFaqById(req.params['id']!, tenantId);
      res.status(200).json({ success: true, data: faq });
    } catch (err) {
      next(err);
    }
  };

  public list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = req.tenantId;
      if (!tenantId) {
        res.status(400).json({ success: false, error: { code: 'MISSING_TENANT_CONTEXT', message: 'Tenant context is missing.' } });
        return;
      }

      const parsed = ListFaqsQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        res.status(422).json({
          success: false,
          error: {
            code: 'VALIDATION_FAILED',
            message: 'Request validation failed.',
            details: parsed.error.errors.map((e) => ({ field: e.path.join('.'), message: e.message })),
          },
        });
        return;
      }

      const faqs = await this.service.listFaqs({
        tenantId,
        limit: parsed.data.limit,
        offset: parsed.data.offset,
      });

      res.status(200).json({ success: true, data: faqs });
    } catch (err) {
      next(err);
    }
  };

  public delete = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = req.tenantId;
      if (!tenantId) {
        res.status(400).json({ success: false, error: { code: 'MISSING_TENANT_CONTEXT', message: 'Tenant context is missing.' } });
        return;
      }

      const actorId = req.user?.userId ?? 'system';
      const requestId = req.requestId ?? '';

      const faq = await this.service.deleteFaq(req.params['id']!, tenantId, actorId, requestId);
      res.status(200).json({ success: true, data: faq });
    } catch (err) {
      next(err);
    }
  };

  public restore = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = req.tenantId;
      if (!tenantId) {
        res.status(400).json({ success: false, error: { code: 'MISSING_TENANT_CONTEXT', message: 'Tenant context is missing.' } });
        return;
      }

      const actorId = req.user?.userId ?? 'system';
      const requestId = req.requestId ?? '';

      const faq = await this.service.restoreFaq(req.params['id']!, tenantId, actorId, requestId);
      res.status(200).json({ success: true, data: faq });
    } catch (err) {
      next(err);
    }
  };
}

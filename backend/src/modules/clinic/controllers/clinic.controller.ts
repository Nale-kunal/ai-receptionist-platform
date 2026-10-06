/**
 * Clinic Controller
 *
 * Maps Express request/response vectors to the Clinic Service actions.
 */

import type { Request, Response, NextFunction } from 'express';
import type { IClinicService } from '../interfaces/clinic.interfaces';
import { CreateClinicSchema } from '../validators/create-clinic.validator';
import { UpdateClinicSchema } from '../validators/update-clinic.validator';
import { UpdateClinicStatusSchema } from '../validators/update-status.validator';
import { TransferOwnershipSchema } from '../validators/transfer-ownership.validator';
import { ClinicError } from '../errors/clinic.errors';
import type { ClinicStatus } from '../constants/clinic.constants';
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

interface CachedClinics {
  payload: any;
  expiresAt: number;
}

export class ClinicController {
  private static clinicCache = new Map<string, CachedClinics>();
  private static readonly TTL_MS = 30000; // 30-second cache

  public static invalidateCache(tenantId?: string): void {
    if (tenantId) {
      for (const key of ClinicController.clinicCache.keys()) {
        if (key.startsWith(tenantId)) {
          ClinicController.clinicCache.delete(key);
        }
      }
    } else {
      ClinicController.clinicCache.clear();
    }
  }

  constructor(private readonly clinicService: IClinicService) {}

  public createClinic = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = req.tenantId;
      if (!tenantId) {
        res.status(400).json({ success: false, error: { code: 'MISSING_TENANT_CONTEXT', message: 'Tenant context is missing.' } });
        return;
      }
      const requestId = req.requestId ?? '';
      const parsed = CreateClinicSchema.safeParse(req.body);
      if (!parsed.success) {
        sendValidationError(res, parsed.error, requestId);
        return;
      }

      const actorId = req.user?.userId ?? 'system';
      const clinic = await this.clinicService.createClinic({
        ...parsed.data,
        tenantId,
        actorId,
        requestId,
      });

      ClinicController.invalidateCache(tenantId);
      sendSuccess(res, { clinic }, 201);
    } catch (err) {
      next(err);
    }
  };

  public updateClinic = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = req.tenantId;
      if (!tenantId) {
        res.status(400).json({ success: false, error: { code: 'MISSING_TENANT_CONTEXT', message: 'Tenant context is missing.' } });
        return;
      }
      const requestId = req.requestId ?? '';
      const { id } = req.params as { id: string };

      const parsed = UpdateClinicSchema.safeParse(req.body);
      if (!parsed.success) {
        sendValidationError(res, parsed.error, requestId);
        return;
      }

      const actorId = req.user?.userId ?? 'system';
      const clinic = await this.clinicService.updateClinic({
        id,
        tenantId,
        ...parsed.data,
        actorId,
        requestId,
      });

      ClinicController.invalidateCache(tenantId);
      sendSuccess(res, { clinic });
    } catch (err) {
      next(err);
    }
  };

  public getClinic = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = req.tenantId;
      if (!tenantId) {
        res.status(400).json({ success: false, error: { code: 'MISSING_TENANT_CONTEXT', message: 'Tenant context is missing.' } });
        return;
      }
      const { id } = req.params as { id: string };
      const clinic = await this.clinicService.getClinicById(id, tenantId);
      sendSuccess(res, { clinic });
    } catch (err) {
      next(err);
    }
  };

  public getClinicBySlug = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = req.tenantId;
      if (!tenantId) {
        res.status(400).json({ success: false, error: { code: 'MISSING_TENANT_CONTEXT', message: 'Tenant context is missing.' } });
        return;
      }
      const { slug } = req.params as { slug: string };
      const clinic = await this.clinicService.getClinicBySlug(slug, tenantId);
      sendSuccess(res, { clinic });
    } catch (err) {
      next(err);
    }
  };

  public listClinics = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = req.tenantId;
      if (!tenantId) {
        res.status(400).json({ success: false, error: { code: 'MISSING_TENANT_CONTEXT', message: 'Tenant context is missing.' } });
        return;
      }
      const status = req.query['status'] as ClinicStatus | undefined;
      const limit = req.query['limit'] ? parseInt(req.query['limit'] as string, 10) : undefined;
      const offset = req.query['offset'] ? parseInt(req.query['offset'] as string, 10) : undefined;

      const cacheKey = `${tenantId}:${status || 'all'}:${limit || 'none'}:${offset || 'none'}`;
      const now = Date.now();
      const cached = ClinicController.clinicCache.get(cacheKey);
      if (cached && cached.expiresAt > now) {
        if (typeof res.setHeader === 'function') {
          res.setHeader('Cache-Control', 'private, no-cache, max-age=0, must-revalidate');
          res.setHeader('Server-Timing', 'cache;desc="HIT"');
        }
        sendSuccess(res, cached.payload);
        return;
      }

      const clinics = await this.clinicService.listClinics({
        tenantId,
        status,
        limit,
        offset,
      });

      const payload = { clinics, total: clinics.length };
      ClinicController.clinicCache.set(cacheKey, {
        payload,
        expiresAt: now + ClinicController.TTL_MS,
      });

      if (typeof res.setHeader === 'function') {
        res.setHeader('Cache-Control', 'private, no-cache, max-age=0, must-revalidate');
      }
      sendSuccess(res, payload);
    } catch (err) {
      next(err);
    }
  };

  public transitionStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = req.tenantId;
      if (!tenantId) {
        res.status(400).json({ success: false, error: { code: 'MISSING_TENANT_CONTEXT', message: 'Tenant context is missing.' } });
        return;
      }
      const requestId = req.requestId ?? '';
      const { id } = req.params as { id: string };

      const parsed = UpdateClinicStatusSchema.safeParse(req.body);
      if (!parsed.success) {
        sendValidationError(res, parsed.error, requestId);
        return;
      }

      const actorId = req.user?.userId ?? 'system';
      const clinic = await this.clinicService.transitionStatus(
        id,
        tenantId,
        parsed.data.status,
        actorId,
        requestId,
      );

      ClinicController.invalidateCache(tenantId);
      sendSuccess(res, { clinic });
    } catch (err) {
      next(err);
    }
  };

  public transferOwnership = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = req.tenantId;
      if (!tenantId) {
        res.status(400).json({ success: false, error: { code: 'MISSING_TENANT_CONTEXT', message: 'Tenant context is missing.' } });
        return;
      }
      const requestId = req.requestId ?? '';
      const { id } = req.params as { id: string };

      const parsed = TransferOwnershipSchema.safeParse(req.body);
      if (!parsed.success) {
        sendValidationError(res, parsed.error, requestId);
        return;
      }

      const actorId = req.user?.userId ?? 'system';
      const clinic = await this.clinicService.transferOwnership(
        id,
        tenantId,
        parsed.data.ownerId,
        actorId,
        requestId,
      );

      ClinicController.invalidateCache(tenantId);
      sendSuccess(res, { clinic });
    } catch (err) {
      next(err);
    }
  };

  public deleteClinic = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = req.tenantId;
      if (!tenantId) {
        res.status(400).json({ success: false, error: { code: 'MISSING_TENANT_CONTEXT', message: 'Tenant context is missing.' } });
        return;
      }
      const requestId = req.requestId ?? '';
      const { id } = req.params as { id: string };
      const actorId = req.user?.userId ?? 'system';

      await this.clinicService.softDeleteClinic(id, tenantId, actorId, requestId);
      ClinicController.invalidateCache(tenantId);
      sendSuccess(res, { deleted: true });
    } catch (err) {
      next(err);
    }
  };

  public restoreClinic = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = req.tenantId;
      if (!tenantId) {
        res.status(400).json({ success: false, error: { code: 'MISSING_TENANT_CONTEXT', message: 'Tenant context is missing.' } });
        return;
      }
      const requestId = req.requestId ?? '';
      const { id } = req.params as { id: string };
      const actorId = req.user?.userId ?? 'system';

      const clinic = await this.clinicService.restoreClinic(id, tenantId, actorId, requestId);
      ClinicController.invalidateCache(tenantId);
      sendSuccess(res, { clinic });
    } catch (err) {
      next(err);
    }
  };
}

export function clinicErrorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (err instanceof ClinicError) {
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

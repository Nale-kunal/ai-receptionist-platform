/**
 * Tenant Controller
 *
 * Maps HTTP transport structures to Service invocations, performs Zod schema
 * validation, and shapes standard JSON API envelopes.
 */

import type { Request, Response, NextFunction } from 'express';
import type { TenantService } from '../services/tenant.service';
import { CreateTenantSchema } from '../validators/create-tenant.validator';
import { UpdateTenantSchema } from '../validators/update-tenant.validator';
import { UpdateTenantStatusSchema } from '../validators/update-status.validator';
import { TenantError } from '../errors/tenant.errors';
import type { TenantStatus, SubscriptionPlan } from '../constants/tenant.constants';
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

export class TenantController {
  constructor(private readonly tenantService: TenantService) {}

  public createTenant = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const requestId = req.requestId ?? '';
      const parsed = CreateTenantSchema.safeParse(req.body);
      if (!parsed.success) {
        sendValidationError(res, parsed.error, requestId);
        return;
      }

      const actorId = req.user?.userId ?? 'system';
      const tenant = await this.tenantService.createTenant({
        ...parsed.data,
        actorId,
        requestId,
      });

      sendSuccess(res, { tenant }, 201);
    } catch (err) {
      next(err);
    }
  };

  public updateTenant = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const requestId = req.requestId ?? '';
      const { id } = req.params as { id: string };
      
      const parsed = UpdateTenantSchema.safeParse(req.body);
      if (!parsed.success) {
        sendValidationError(res, parsed.error, requestId);
        return;
      }

      const actorId = req.user?.userId ?? 'system';
      const tenant = await this.tenantService.updateTenant({
        id,
        ...parsed.data,
        actorId,
        requestId,
      });

      sendSuccess(res, { tenant });
    } catch (err) {
      next(err);
    }
  };

  public getTenant = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params as { id: string };
      const tenant = await this.tenantService.getTenantById(id);
      sendSuccess(res, { tenant });
    } catch (err) {
      next(err);
    }
  };

  public getTenantBySlug = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { slug } = req.params as { slug: string };
      const tenant = await this.tenantService.getTenantBySlug(slug);
      sendSuccess(res, { tenant });
    } catch (err) {
      next(err);
    }
  };

  public listTenants = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const status = req.query['status'] as TenantStatus | undefined;
      const limit = req.query['limit'] ? parseInt(req.query['limit'] as string, 10) : undefined;
      const offset = req.query['offset'] ? parseInt(req.query['offset'] as string, 10) : undefined;

      const tenants = await this.tenantService.listTenants({ status, limit, offset });
      sendSuccess(res, { tenants, total: tenants.length });
    } catch (err) {
      next(err);
    }
  };

  public activateTenant = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const requestId = req.requestId ?? '';
      const { id } = req.params as { id: string };
      const actorId = req.user?.userId ?? 'system';

      const tenant = await this.tenantService.activateTenant(id, actorId, requestId);
      sendSuccess(res, { tenant });
    } catch (err) {
      next(err);
    }
  };

  public suspendTenant = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const requestId = req.requestId ?? '';
      const { id } = req.params as { id: string };
      const actorId = req.user?.userId ?? 'system';

      const tenant = await this.tenantService.suspendTenant(id, actorId, requestId);
      sendSuccess(res, { tenant });
    } catch (err) {
      next(err);
    }
  };

  public archiveTenant = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const requestId = req.requestId ?? '';
      const { id } = req.params as { id: string };
      const actorId = req.user?.userId ?? 'system';

      const tenant = await this.tenantService.archiveTenant(id, actorId, requestId);
      sendSuccess(res, { tenant });
    } catch (err) {
      next(err);
    }
  };

  public deleteTenant = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const requestId = req.requestId ?? '';
      const { id } = req.params as { id: string };
      const actorId = req.user?.userId ?? 'system';

      await this.tenantService.softDeleteTenant(id, actorId, requestId);
      sendSuccess(res, { deleted: true });
    } catch (err) {
      next(err);
    }
  };

  public restoreTenant = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const requestId = req.requestId ?? '';
      const { id } = req.params as { id: string };
      const actorId = req.user?.userId ?? 'system';

      const tenant = await this.tenantService.restoreTenant(id, actorId, requestId);
      sendSuccess(res, { tenant });
    } catch (err) {
      next(err);
    }
  };

  public updateSubscription = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const requestId = req.requestId ?? '';
      const { id } = req.params as { id: string };
      const { subscriptionPlan } = req.body as { subscriptionPlan: SubscriptionPlan };
      const actorId = req.user?.userId ?? 'system';

      const tenant = await this.tenantService.updateSubscriptionPlan(id, subscriptionPlan, actorId, requestId);
      sendSuccess(res, { tenant });
    } catch (err) {
      next(err);
    }
  };
}

export function tenantErrorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (err instanceof TenantError) {
    res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        details: [],
      },
      requestId: req.requestId ?? '',
      timestamp: new Date().toISOString(),
    });
    return;
  }
  next(err);
}

/**
 * Configuration Controller
 *
 * Maps Express request/response vectors to the Configuration Service.
 */

import type { Request, Response, NextFunction } from 'express';
import type { IConfigurationService } from '../interfaces/configuration.interfaces';
import { CreateConfigurationSchema } from '../validators/create-configuration.validator';
import { UpdateConfigurationSchema } from '../validators/update-configuration.validator';
import { RollbackConfigurationSchema } from '../validators/rollback-configuration.validator';
import { ConfigurationError } from '../errors/configuration.errors';
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

export class ConfigurationController {
  constructor(private readonly configService: IConfigurationService) {}

  public getActiveConfiguration = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const tenantId = req.tenantId;
      if (!tenantId) {
        res.status(400).json({ success: false, error: { code: 'MISSING_TENANT_CONTEXT', message: 'Tenant context is missing.' } });
        return;
      }
      const clinicId = req.query['clinicId'] ? (req.query['clinicId'] as string) : (req.user?.clinicId ?? null);
      const configuration = await this.configService.getActiveConfiguration(tenantId, clinicId);
      sendSuccess(res, { configuration });
    } catch (err) {
      next(err);
    }
  };

  public getConfigurationById = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const tenantId = req.tenantId;
      if (!tenantId) {
        res.status(400).json({ success: false, error: { code: 'MISSING_TENANT_CONTEXT', message: 'Tenant context is missing.' } });
        return;
      }
      const { id } = req.params as { id: string };
      const configuration = await this.configService.getConfigurationById(id, tenantId);
      sendSuccess(res, { configuration });
    } catch (err) {
      next(err);
    }
  };

  public listConfigurationHistory = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const tenantId = req.tenantId;
      if (!tenantId) {
        res.status(400).json({ success: false, error: { code: 'MISSING_TENANT_CONTEXT', message: 'Tenant context is missing.' } });
        return;
      }
      const clinicId = req.query['clinicId'] ? (req.query['clinicId'] as string) : (req.user?.clinicId ?? null);
      const limit = req.query['limit'] ? parseInt(req.query['limit'] as string, 10) : undefined;
      const offset = req.query['offset'] ? parseInt(req.query['offset'] as string, 10) : undefined;

      const history = await this.configService.listConfigurationHistory(
        tenantId,
        clinicId,
        limit,
        offset,
      );
      sendSuccess(res, { history, total: history.length });
    } catch (err) {
      next(err);
    }
  };

  public createConfiguration = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const tenantId = req.tenantId;
      if (!tenantId) {
        res.status(400).json({ success: false, error: { code: 'MISSING_TENANT_CONTEXT', message: 'Tenant context is missing.' } });
        return;
      }
      const requestId = req.requestId ?? '';
      const parsed = CreateConfigurationSchema.safeParse(req.body);
      if (!parsed.success) {
        sendValidationError(res, parsed.error, requestId);
        return;
      }

      const createdBy = req.user?.userId ?? 'system';
      const configuration = await this.configService.createConfiguration({
        ...parsed.data,
        tenantId,
        createdBy,
        requestId,
      });

      sendSuccess(res, { configuration }, 201);
    } catch (err) {
      next(err);
    }
  };

  public updateConfiguration = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const tenantId = req.tenantId;
      if (!tenantId) {
        res.status(400).json({ success: false, error: { code: 'MISSING_TENANT_CONTEXT', message: 'Tenant context is missing.' } });
        return;
      }
      const requestId = req.requestId ?? '';
      const parsed = UpdateConfigurationSchema.safeParse(req.body);
      if (!parsed.success) {
        sendValidationError(res, parsed.error, requestId);
        return;
      }

      const clinicId = req.user?.clinicId ?? null;
      const updatedBy = req.user?.userId ?? 'system';
      const configuration = await this.configService.updateConfiguration({
        ...parsed.data,
        tenantId,
        clinicId,
        updatedBy,
        requestId,
      });

      sendSuccess(res, { configuration });
    } catch (err) {
      next(err);
    }
  };

  public rollbackConfiguration = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const tenantId = req.tenantId;
      if (!tenantId) {
        res.status(400).json({ success: false, error: { code: 'MISSING_TENANT_CONTEXT', message: 'Tenant context is missing.' } });
        return;
      }
      const requestId = req.requestId ?? '';
      const { id } = req.params as { id: string };

      const parsed = RollbackConfigurationSchema.safeParse(req.body);
      if (!parsed.success) {
        sendValidationError(res, parsed.error, requestId);
        return;
      }

      const actorId = req.user?.userId ?? 'system';
      const configuration = await this.configService.rollbackConfiguration(
        id,
        tenantId,
        actorId,
        requestId,
      );

      sendSuccess(res, { configuration });
    } catch (err) {
      next(err);
    }
  };
}

export function configurationErrorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (err instanceof ConfigurationError) {
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

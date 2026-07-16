/**
 * Notification Controller
 *
 * Maps Express request/response to NotificationService methods.
 * Contains no business logic — delegates entirely to the service.
 */

import type { Request, Response, NextFunction } from 'express';
import type { INotificationService } from '../interfaces/notification.interfaces';
import { CreateNotificationSchema } from '../validators/create-notification.validator';
import { ListNotificationsSchema } from '../validators/list-notifications.validator';
import { UpdatePreferencesSchema } from '../validators/update-preferences.validator';
import { NotificationError } from '../errors/notification.errors';
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

export class NotificationController {
  constructor(private readonly notificationService: INotificationService) {}

  /** POST /api/v1/notifications */
  public createNotification = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = req.tenantId;
      if (!tenantId) {
        res.status(400).json({ success: false, error: { code: 'MISSING_TENANT_CONTEXT', message: 'Tenant context is missing.' } });
        return;
      }
      const requestId = req.requestId ?? '';
      const parsed = CreateNotificationSchema.safeParse(req.body);
      if (!parsed.success) {
        sendValidationError(res, parsed.error, requestId);
        return;
      }

      const actorId = req.user?.userId ?? 'system';
      const notification = await this.notificationService.createNotification({
        tenantId,
        ...parsed.data,
        scheduledAt: parsed.data.scheduledAt ? new Date(parsed.data.scheduledAt) : undefined,
        actorId,
        requestId,
      });

      sendSuccess(res, { notification }, 201);
    } catch (err) {
      next(err);
    }
  };

  /** GET /api/v1/notifications */
  public listNotifications = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = req.tenantId;
      if (!tenantId) {
        res.status(400).json({ success: false, error: { code: 'MISSING_TENANT_CONTEXT', message: 'Tenant context is missing.' } });
        return;
      }
      const parsed = ListNotificationsSchema.safeParse(req.query);
      if (!parsed.success) {
        sendValidationError(res, parsed.error, req.requestId ?? '');
        return;
      }

      const { scheduledFrom, scheduledTo, ...rest } = parsed.data;
      const notifications = await this.notificationService.listNotifications({
        tenantId,
        ...rest,
        scheduledFrom: scheduledFrom ? new Date(scheduledFrom) : undefined,
        scheduledTo: scheduledTo ? new Date(scheduledTo) : undefined,
      });

      sendSuccess(res, { notifications, total: notifications.length });
    } catch (err) {
      next(err);
    }
  };

  /** GET /api/v1/notifications/:id */
  public getNotification = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = req.tenantId;
      if (!tenantId) {
        res.status(400).json({ success: false, error: { code: 'MISSING_TENANT_CONTEXT', message: 'Tenant context is missing.' } });
        return;
      }
      const { id } = req.params as { id: string };
      const notification = await this.notificationService.getNotificationById(id, tenantId);
      sendSuccess(res, { notification });
    } catch (err) {
      next(err);
    }
  };

  /** GET /api/v1/notifications/public/:publicId */
  public getNotificationByPublicId = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = req.tenantId;
      if (!tenantId) {
        res.status(400).json({ success: false, error: { code: 'MISSING_TENANT_CONTEXT', message: 'Tenant context is missing.' } });
        return;
      }
      const { publicId } = req.params as { publicId: string };
      const notification = await this.notificationService.getNotificationByPublicId(publicId, tenantId);
      sendSuccess(res, { notification });
    } catch (err) {
      next(err);
    }
  };

  /** POST /api/v1/notifications/:id/send */
  public sendImmediate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = req.tenantId;
      if (!tenantId) {
        res.status(400).json({ success: false, error: { code: 'MISSING_TENANT_CONTEXT', message: 'Tenant context is missing.' } });
        return;
      }
      const requestId = req.requestId ?? '';
      const { id } = req.params as { id: string };

      const actorId = req.user?.userId ?? 'system';
      const notification = await this.notificationService.sendImmediate(id, tenantId, actorId, requestId);

      sendSuccess(res, { notification });
    } catch (err) {
      next(err);
    }
  };

  /** POST /api/v1/notifications/:id/cancel */
  public cancelNotification = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = req.tenantId;
      if (!tenantId) {
        res.status(400).json({ success: false, error: { code: 'MISSING_TENANT_CONTEXT', message: 'Tenant context is missing.' } });
        return;
      }
      const requestId = req.requestId ?? '';
      const { id } = req.params as { id: string };

      const actorId = req.user?.userId ?? 'system';
      const notification = await this.notificationService.cancelNotification(id, tenantId, actorId, requestId);

      sendSuccess(res, { notification });
    } catch (err) {
      next(err);
    }
  };

  /** POST /api/v1/notifications/process-queue */
  public processQueue = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = req.tenantId;
      if (!tenantId) {
        res.status(400).json({ success: false, error: { code: 'MISSING_TENANT_CONTEXT', message: 'Tenant context is missing.' } });
        return;
      }
      const requestId = req.requestId ?? '';
      const actorId = req.user?.userId ?? 'system';

      await this.notificationService.processQueue(tenantId, actorId, requestId);

      sendSuccess(res, { success: true });
    } catch (err) {
      next(err);
    }
  };

  /** GET /api/v1/notifications/preferences/:patientId */
  public getPatientPreferences = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = req.tenantId;
      if (!tenantId) {
        res.status(400).json({ success: false, error: { code: 'MISSING_TENANT_CONTEXT', message: 'Tenant context is missing.' } });
        return;
      }
      const { patientId } = req.params as { patientId: string };
      const preferences = await this.notificationService.getPatientPreferences(patientId, tenantId);

      if (!preferences) {
        res.status(404).json({ success: false, error: { code: 'PREFERENCES_NOT_FOUND', message: 'Preferences not found for patient.' } });
        return;
      }

      sendSuccess(res, { preferences });
    } catch (err) {
      next(err);
    }
  };

  /** PATCH /api/v1/notifications/preferences/:patientId */
  public updatePatientPreferences = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = req.tenantId;
      if (!tenantId) {
        res.status(400).json({ success: false, error: { code: 'MISSING_TENANT_CONTEXT', message: 'Tenant context is missing.' } });
        return;
      }
      const requestId = req.requestId ?? '';
      const { patientId } = req.params as { patientId: string };

      const parsed = UpdatePreferencesSchema.safeParse(req.body);
      if (!parsed.success) {
        sendValidationError(res, parsed.error, requestId);
        return;
      }

      const preferences = await this.notificationService.updatePatientPreferences(patientId, tenantId, parsed.data);

      sendSuccess(res, { preferences });
    } catch (err) {
      next(err);
    }
  };
}

// ---------------------------------------------------------------------------
// Module-level Error Handler
// ---------------------------------------------------------------------------

export function notificationErrorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (err instanceof NotificationError) {
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

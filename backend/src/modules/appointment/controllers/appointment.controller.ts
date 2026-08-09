/**
 * Appointment Controller
 *
 * Maps Express request/response to AppointmentService methods.
 * Contains no business logic — delegates entirely to the service.
 */

import type { Request, Response, NextFunction } from 'express';
import type { IAppointmentService } from '../interfaces/appointment.interfaces';
import { CreateAppointmentSchema }     from '../validators/create-appointment.validator';
import { UpdateAppointmentSchema }     from '../validators/update-appointment.validator';
import { RescheduleAppointmentSchema } from '../validators/reschedule-appointment.validator';
import { CancelAppointmentSchema }     from '../validators/cancel-appointment.validator';
import { ListAppointmentsSchema }      from '../validators/list-appointments.validator';
import { AppointmentError }            from '../errors/appointment.errors';
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

export class AppointmentController {
  constructor(private readonly appointmentService: IAppointmentService) {}

  /** POST /api/v1/appointments */
  public createAppointment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = req.tenantId;
      if (!tenantId) {
        res.status(400).json({ success: false, error: { code: 'MISSING_TENANT_CONTEXT', message: 'Tenant context is missing.' } });
        return;
      }
      const requestId = req.requestId ?? '';
      const parsed = CreateAppointmentSchema.safeParse(req.body);
      if (!parsed.success) {
        sendValidationError(res, parsed.error, requestId);
        return;
      }

      const actorId = req.user?.userId ?? 'system';
      const appointment = await this.appointmentService.createAppointment({
        tenantId,
        clinicId:  parsed.data.clinicId,
        doctorId:  parsed.data.doctorId,
        patientId: parsed.data.patientId,
        startTime: new Date(parsed.data.startTime),
        endTime:   new Date(parsed.data.endTime),
        timezone:  parsed.data.timezone,
        source:    parsed.data.source,
        appointmentType: parsed.data.appointmentType,
        durationMinutes: parsed.data.durationMinutes,
        notes:     parsed.data.notes,
        actorId,
        requestId,
      });

      sendSuccess(res, { appointment }, 201);
    } catch (err) {
      next(err);
    }
  };

  /** GET /api/v1/appointments */
  public listAppointments = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = req.tenantId;
      if (!tenantId) {
        res.status(400).json({ success: false, error: { code: 'MISSING_TENANT_CONTEXT', message: 'Tenant context is missing.' } });
        return;
      }
      const parsed = ListAppointmentsSchema.safeParse(req.query);
      if (!parsed.success) {
        sendValidationError(res, parsed.error, req.requestId ?? '');
        return;
      }

      const { startFrom, startTo, ...rest } = parsed.data;
      const result = await this.appointmentService.listAppointments({
        tenantId,
        ...rest,
        startFrom: startFrom ? new Date(startFrom) : undefined,
        startTo:   startTo   ? new Date(startTo)   : undefined,
      });

      sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  };

  /** GET /api/v1/appointments/counters */
  public getStatusCounters = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = req.tenantId;
      if (!tenantId) {
        res.status(400).json({ success: false, error: { code: 'MISSING_TENANT_CONTEXT', message: 'Tenant context is missing.' } });
        return;
      }
      const clinicId = typeof req.query.clinicId === 'string' ? req.query.clinicId : undefined;
      const counters = await this.appointmentService.getStatusCounters(tenantId, clinicId);
      sendSuccess(res, counters);
    } catch (err) {
      next(err);
    }
  };

  /** GET /api/v1/appointments/:id */
  public getAppointment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = req.tenantId;
      if (!tenantId) {
        res.status(400).json({ success: false, error: { code: 'MISSING_TENANT_CONTEXT', message: 'Tenant context is missing.' } });
        return;
      }
      const { id } = req.params as { id: string };
      const appointment = await this.appointmentService.getAppointmentById(id, tenantId);
      sendSuccess(res, { appointment });
    } catch (err) {
      next(err);
    }
  };

  /** GET /api/v1/appointments/public/:publicId */
  public getAppointmentByPublicId = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = req.tenantId;
      if (!tenantId) {
        res.status(400).json({ success: false, error: { code: 'MISSING_TENANT_CONTEXT', message: 'Tenant context is missing.' } });
        return;
      }
      const { publicId } = req.params as { publicId: string };
      const appointment = await this.appointmentService.getAppointmentByPublicId(publicId, tenantId);
      sendSuccess(res, { appointment });
    } catch (err) {
      next(err);
    }
  };

  /** PATCH /api/v1/appointments/:id */
  public updateAppointment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = req.tenantId;
      if (!tenantId) {
        res.status(400).json({ success: false, error: { code: 'MISSING_TENANT_CONTEXT', message: 'Tenant context is missing.' } });
        return;
      }
      const requestId = req.requestId ?? '';
      const { id } = req.params as { id: string };

      const parsed = UpdateAppointmentSchema.safeParse(req.body);
      if (!parsed.success) {
        sendValidationError(res, parsed.error, requestId);
        return;
      }

      const actorId = req.user?.userId ?? 'system';
      const appointment = await this.appointmentService.updateAppointment({
        id,
        tenantId,
        notes: parsed.data.notes,
        actorId,
        requestId,
      });

      sendSuccess(res, { appointment });
    } catch (err) {
      next(err);
    }
  };

  /** POST /api/v1/appointments/:id/confirm */
  public confirmAppointment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = req.tenantId;
      if (!tenantId) {
        res.status(400).json({ success: false, error: { code: 'MISSING_TENANT_CONTEXT', message: 'Tenant context is missing.' } });
        return;
      }
      const { id } = req.params as { id: string };
      const actorId   = req.user?.userId ?? 'system';
      const requestId = req.requestId ?? '';

      const appointment = await this.appointmentService.confirmAppointment(id, tenantId, actorId, requestId);
      sendSuccess(res, { appointment });
    } catch (err) {
      next(err);
    }
  };

  /** POST /api/v1/appointments/:id/cancel */
  public cancelAppointment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = req.tenantId;
      if (!tenantId) {
        res.status(400).json({ success: false, error: { code: 'MISSING_TENANT_CONTEXT', message: 'Tenant context is missing.' } });
        return;
      }
      const requestId = req.requestId ?? '';
      const { id } = req.params as { id: string };

      const parsed = CancelAppointmentSchema.safeParse(req.body);
      if (!parsed.success) {
        sendValidationError(res, parsed.error, requestId);
        return;
      }

      const actorId = req.user?.userId ?? 'system';
      const appointment = await this.appointmentService.cancelAppointment({
        id,
        tenantId,
        cancellationReason: parsed.data.cancellationReason,
        actorId,
        requestId,
      });

      sendSuccess(res, { appointment });
    } catch (err) {
      next(err);
    }
  };

  /** POST /api/v1/appointments/:id/reschedule */
  public rescheduleAppointment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = req.tenantId;
      if (!tenantId) {
        res.status(400).json({ success: false, error: { code: 'MISSING_TENANT_CONTEXT', message: 'Tenant context is missing.' } });
        return;
      }
      const requestId = req.requestId ?? '';
      const { id } = req.params as { id: string };

      const parsed = RescheduleAppointmentSchema.safeParse(req.body);
      if (!parsed.success) {
        sendValidationError(res, parsed.error, requestId);
        return;
      }

      const actorId = req.user?.userId ?? 'system';
      const appointment = await this.appointmentService.rescheduleAppointment({
        id,
        tenantId,
        startTime:       new Date(parsed.data.startTime),
        endTime:         new Date(parsed.data.endTime),
        durationMinutes: parsed.data.durationMinutes,
        timezone:        parsed.data.timezone,
        notes:           parsed.data.notes,
        actorId,
        requestId,
      });

      sendSuccess(res, { appointment });
    } catch (err) {
      next(err);
    }
  };

  /** POST /api/v1/appointments/:id/complete */
  public completeAppointment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = req.tenantId;
      if (!tenantId) {
        res.status(400).json({ success: false, error: { code: 'MISSING_TENANT_CONTEXT', message: 'Tenant context is missing.' } });
        return;
      }
      const { id } = req.params as { id: string };
      const actorId   = req.user?.userId ?? 'system';
      const requestId = req.requestId ?? '';

      const appointment = await this.appointmentService.completeAppointment(id, tenantId, actorId, requestId);
      sendSuccess(res, { appointment });
    } catch (err) {
      next(err);
    }
  };

  /** POST /api/v1/appointments/:id/no-show */
  public markNoShow = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = req.tenantId;
      if (!tenantId) {
        res.status(400).json({ success: false, error: { code: 'MISSING_TENANT_CONTEXT', message: 'Tenant context is missing.' } });
        return;
      }
      const { id } = req.params as { id: string };
      const actorId   = req.user?.userId ?? 'system';
      const requestId = req.requestId ?? '';

      const appointment = await this.appointmentService.markNoShow(id, tenantId, actorId, requestId);
      sendSuccess(res, { appointment });
    } catch (err) {
      next(err);
    }
  };
}

// ---------------------------------------------------------------------------
// Module-level Error Handler
// ---------------------------------------------------------------------------

export function appointmentErrorHandler(
  err: Error | any,
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const requestId = (req as any).requestId ?? '';
  const timestamp = new Date().toISOString();

  if (err instanceof AppointmentError) {
    res.status(err.statusCode).json({
      success: false,
      error: {
        code:    err.code,
        message: err.message,
        details: err.details ? [err.details] : [],
      },
      requestId,
      timestamp,
    });
    return;
  }

  // Handle Prisma Known Request Errors
  if (err && typeof err === 'object' && err.code && typeof err.code === 'string' && err.code.startsWith('P')) {
    console.error('[Prisma Error Details]:', { code: err.code, message: err.message, meta: err.meta });
    let statusCode = 400;
    let code = 'DATABASE_ERROR';
    let message = 'A database error occurred.';

    if (err.code === 'P2025') {
      statusCode = 404;
      code = 'APPOINTMENT_NOT_FOUND';
      message = 'The requested appointment record was not found.';
    } else if (err.code === 'P2002') {
      statusCode = 409;
      code = 'APPOINTMENT_SLOT_TAKEN';
      message = 'A conflicting appointment record already exists.';
    }

    res.status(statusCode).json({
      success: false,
      error: { code, message },
      requestId,
      timestamp,
    });
    return;
  }

  // Pass to Express default error handler for non-domain errors
  next(err);
}

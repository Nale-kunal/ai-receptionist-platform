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
    requestId: (res.req as Request)?.requestId ?? '',
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

import { DashboardController } from '../../dashboard/dashboard.controller';
import { prisma } from '../../../shared/database/prisma';

interface CachedAppointments {
  payload: any;
  expiresAt: number;
}

export class AppointmentController {
  private static appointmentCache = new Map<string, CachedAppointments>();
  private static readonly TTL_MS = 15000; // 15-second high-speed micro-cache

  private async resolveDoctorId(tenantId: string, email?: string): Promise<string | null> {
    if (!email) return null;
    const doc = await prisma.doctor.findFirst({
      where: { tenantId, email, deletedAt: null },
      select: { id: true },
    });
    return doc?.id || null;
  }

  public static invalidateCache(tenantId?: string): void {
    if (tenantId) {
      for (const key of AppointmentController.appointmentCache.keys()) {
        if (key.startsWith(tenantId)) {
          AppointmentController.appointmentCache.delete(key);
        }
      }
      DashboardController.invalidateCache(tenantId);
    } else {
      AppointmentController.appointmentCache.clear();
      DashboardController.invalidateCache();
    }
  }

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
        otherReason: parsed.data.otherReason || parsed.data.reasonDetails,
        durationMinutes: parsed.data.durationMinutes,
        notes:     parsed.data.notes,
        actorId,
        requestId,
      });

      AppointmentController.invalidateCache(tenantId);
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

      const userRole = req.user?.role;
      const userEmail = req.user?.email;
      const isDoctor = userRole === 'doctor';

      let doctorId: string | null = null;
      if (isDoctor) {
        doctorId = await this.resolveDoctorId(tenantId, userEmail);
        if (!doctorId) {
          // Doctor not yet configured — return empty list safely
          sendSuccess(res, {
            appointments: [],
            total: 0,
            page: parsed.data.page || 1,
            limit: parsed.data.limit || 20,
            totalPages: 0,
          });
          return;
        }
        parsed.data.doctorId = doctorId;
      }

      const { startFrom, startTo, ...rest } = parsed.data;
      const cacheKey = `${tenantId}:${isDoctor ? `doctor:${doctorId}` : 'all'}:${rest.clinicId || ''}:${rest.patientId || ''}:${rest.status || ''}:${rest.search || ''}:${rest.page || 1}:${rest.limit || 20}:${startFrom || ''}:${startTo || ''}`;
      const now = Date.now();
      const cached = AppointmentController.appointmentCache.get(cacheKey);
      if (cached && cached.expiresAt > now) {
        if (typeof res.setHeader === 'function') {
          res.setHeader('Cache-Control', 'private, no-cache, max-age=0, must-revalidate');
          res.setHeader('Server-Timing', 'cache;desc="HIT"');
        }
        sendSuccess(res, cached.payload);
        return;
      }

      const result = await this.appointmentService.listAppointments({
        tenantId,
        ...rest,
        startFrom: startFrom ? new Date(startFrom) : undefined,
        startTo:   startTo   ? new Date(startTo)   : undefined,
      });

      AppointmentController.appointmentCache.set(cacheKey, {
        payload: result,
        expiresAt: now + AppointmentController.TTL_MS,
      });

      if (typeof res.setHeader === 'function') {
        res.setHeader('Cache-Control', 'private, no-cache, max-age=0, must-revalidate');
      }
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

      const userRole = req.user?.role;
      const userEmail = req.user?.email;
      const isDoctor = userRole === 'doctor';

      if (isDoctor) {
        const doctorId = await this.resolveDoctorId(tenantId, userEmail);
        if (!doctorId) {
          sendSuccess(res, {
            total: 0,
            scheduled: 0,
            pending: 0,
            confirmed: 0,
            in_progress: 0,
            completed: 0,
            cancelled: 0,
            no_show: 0,
            rescheduled: 0,
          });
          return;
        }

        const counts = await prisma.appointment.groupBy({
          by: ['status'],
          where: {
            tenantId,
            doctorId,
            deletedAt: null,
          },
          _count: { _all: true },
        });

        const counters: Record<string, number> = {
          total: 0,
          scheduled: 0,
          pending: 0,
          confirmed: 0,
          in_progress: 0,
          completed: 0,
          cancelled: 0,
          no_show: 0,
          rescheduled: 0,
        };

        for (const c of counts) {
          const s = c.status.toLowerCase();
          const cnt = c._count._all;
          counters[s] = cnt;
          counters.total += cnt;
        }

        sendSuccess(res, counters);
        return;
      }

      const clinicId = typeof req.query.clinicId === 'string' ? req.query.clinicId : undefined;
      const counters = await this.appointmentService.getStatusCounters(tenantId, clinicId);
      sendSuccess(res, counters);
    } catch (err) {
      next(err);
    }
  };

  /** Helper to verify appointment ownership for doctors */
  private async verifyDoctorAccess(id: string, tenantId: string, req: Request): Promise<boolean> {
    if (req.user?.role !== 'doctor') return true;
    const doctorId = await this.resolveDoctorId(tenantId, req.user?.email);
    if (!doctorId) return false;

    const appt = await prisma.appointment.findFirst({
      where: { id, tenantId, deletedAt: null },
      select: { doctorId: true },
    });
    return !!appt && appt.doctorId === doctorId;
  }

  /** GET /api/v1/appointments/:id */
  public getAppointment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = req.tenantId;
      if (!tenantId) {
        res.status(400).json({ success: false, error: { code: 'MISSING_TENANT_CONTEXT', message: 'Tenant context is missing.' } });
        return;
      }
      const { id } = req.params as { id: string };

      const hasAccess = await this.verifyDoctorAccess(id, tenantId, req);
      if (!hasAccess) {
        res.status(404).json({ success: false, error: { code: 'APPOINTMENT_NOT_FOUND', message: 'Appointment not found.' } });
        return;
      }

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

      const hasAccess = await this.verifyDoctorAccess(id, tenantId, req);
      if (!hasAccess) {
        res.status(404).json({ success: false, error: { code: 'APPOINTMENT_NOT_FOUND', message: 'Appointment not found.' } });
        return;
      }

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

      AppointmentController.invalidateCache(tenantId);
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

      const hasAccess = await this.verifyDoctorAccess(id, tenantId, req);
      if (!hasAccess) {
        res.status(404).json({ success: false, error: { code: 'APPOINTMENT_NOT_FOUND', message: 'Appointment not found.' } });
        return;
      }

      const actorId   = req.user?.userId ?? 'system';
      const requestId = req.requestId ?? '';

      const appointment = await this.appointmentService.confirmAppointment(id, tenantId, actorId, requestId);
      AppointmentController.invalidateCache(tenantId);
      sendSuccess(res, { appointment });
    } catch (err) {
      next(err);
    }
  };

  /** POST /api/v1/appointments/:id/check-in */
  public checkInAppointment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = req.tenantId;
      if (!tenantId) {
        res.status(400).json({ success: false, error: { code: 'MISSING_TENANT_CONTEXT', message: 'Tenant context is missing.' } });
        return;
      }
      const { id } = req.params as { id: string };

      const hasAccess = await this.verifyDoctorAccess(id, tenantId, req);
      if (!hasAccess) {
        res.status(404).json({ success: false, error: { code: 'APPOINTMENT_NOT_FOUND', message: 'Appointment not found.' } });
        return;
      }

      const actorId   = req.user?.userId ?? 'system';
      const requestId = req.requestId ?? '';

      const appointment = await this.appointmentService.checkInAppointment(id, tenantId, actorId, requestId);
      AppointmentController.invalidateCache(tenantId);
      sendSuccess(res, { appointment });
    } catch (err) {
      next(err);
    }
  };

  /** POST /api/v1/appointments/:id/start */
  public startAppointment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = req.tenantId;
      if (!tenantId) {
        res.status(400).json({ success: false, error: { code: 'MISSING_TENANT_CONTEXT', message: 'Tenant context is missing.' } });
        return;
      }
      const { id } = req.params as { id: string };

      const hasAccess = await this.verifyDoctorAccess(id, tenantId, req);
      if (!hasAccess) {
        res.status(404).json({ success: false, error: { code: 'APPOINTMENT_NOT_FOUND', message: 'Appointment not found.' } });
        return;
      }

      const actorId   = req.user?.userId ?? 'system';
      const requestId = req.requestId ?? '';

      const appointment = await this.appointmentService.startAppointment(id, tenantId, actorId, requestId);
      AppointmentController.invalidateCache(tenantId);
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

      const hasAccess = await this.verifyDoctorAccess(id, tenantId, req);
      if (!hasAccess) {
        res.status(404).json({ success: false, error: { code: 'APPOINTMENT_NOT_FOUND', message: 'Appointment not found.' } });
        return;
      }

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

      AppointmentController.invalidateCache(tenantId);
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

      const hasAccess = await this.verifyDoctorAccess(id, tenantId, req);
      if (!hasAccess) {
        res.status(404).json({ success: false, error: { code: 'APPOINTMENT_NOT_FOUND', message: 'Appointment not found.' } });
        return;
      }

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

      AppointmentController.invalidateCache(tenantId);
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

      const hasAccess = await this.verifyDoctorAccess(id, tenantId, req);
      if (!hasAccess) {
        res.status(404).json({ success: false, error: { code: 'APPOINTMENT_NOT_FOUND', message: 'Appointment not found.' } });
        return;
      }

      const actorId   = req.user?.userId ?? 'system';
      const requestId = req.requestId ?? '';

      const appointment = await this.appointmentService.completeAppointment(id, tenantId, actorId, requestId);
      AppointmentController.invalidateCache(tenantId);
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

      const hasAccess = await this.verifyDoctorAccess(id, tenantId, req);
      if (!hasAccess) {
        res.status(404).json({ success: false, error: { code: 'APPOINTMENT_NOT_FOUND', message: 'Appointment not found.' } });
        return;
      }

      const actorId   = req.user?.userId ?? 'system';
      const requestId = req.requestId ?? '';

      const appointment = await this.appointmentService.markNoShow(id, tenantId, actorId, requestId);
      AppointmentController.invalidateCache(tenantId);
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

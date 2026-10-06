/**
 * Calendar Controller
 *
 * Maps Express request/response payloads to ICalendarService.
 * Pure HTTP mapping — no business logic.
 */

import type { Request, Response, NextFunction } from 'express';
import type { ICalendarService } from '../interfaces/calendar.interfaces';
import { ConnectCalendarSchema } from '../validators/connect-calendar.validator';
import { ListConnectionsSchema } from '../validators/list-connections.validator';
import { CalendarError } from '../errors/calendar.errors';
import { ZodError } from 'zod';
import type { CalendarProvider } from '../constants/calendar.constants';

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
// Calendar Controller Class
// ---------------------------------------------------------------------------

export class CalendarController {
  constructor(private readonly calendarService: ICalendarService) {}

  /** POST /api/v1/calendars */
  public connectCalendar = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = req.tenantId;
      if (!tenantId) {
        res.status(400).json({ success: false, error: { code: 'MISSING_TENANT_CONTEXT', message: 'Tenant context is missing.' } });
        return;
      }
      const requestId = req.requestId ?? '';
      const parsed = ConnectCalendarSchema.safeParse(req.body);
      if (!parsed.success) {
        sendValidationError(res, parsed.error, requestId);
        return;
      }

      const actorId = req.user?.userId ?? 'system';
      const connection = await this.calendarService.connectCalendar({
        tenantId,
        ...parsed.data,
        tokenExpiry: parsed.data.tokenExpiry ? new Date(parsed.data.tokenExpiry) : null,
        actorId,
        requestId,
      });

      sendSuccess(res, { connection }, 201);
    } catch (err) {
      next(err);
    }
  };

  /** POST /api/v1/calendars/:id/disconnect */
  public disconnectCalendar = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = req.tenantId;
      if (!tenantId) {
        res.status(400).json({ success: false, error: { code: 'MISSING_TENANT_CONTEXT', message: 'Tenant context is missing.' } });
        return;
      }
      const { id } = req.params as { id: string };
      const actorId = req.user?.userId ?? 'system';
      const requestId = req.requestId ?? '';

      const connection = await this.calendarService.disconnectCalendar(id, tenantId, actorId, requestId);
      sendSuccess(res, { connection });
    } catch (err) {
      next(err);
    }
  };

  /** GET /api/v1/calendars/availability or /api/v1/calendars/:id/availability */
  public getAvailability = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = req.tenantId;
      if (!tenantId) {
        res.status(400).json({ success: false, error: { code: 'MISSING_TENANT_CONTEXT', message: 'Tenant context is missing.' } });
        return;
      }

      const { id } = req.params as { id?: string };
      const {
        doctorId,
        date,
        durationMinutes,
        appointmentType,
        excludeAppointmentId,
        excludeUnavailable,
        stepMinutes,
        bufferMinutes,
        startTime,
        endTime,
      } = req.query as {
        doctorId?: string;
        date?: string;
        durationMinutes?: string;
        appointmentType?: string;
        excludeAppointmentId?: string;
        excludeUnavailable?: string;
        stepMinutes?: string;
        bufferMinutes?: string;
        startTime?: string;
        endTime?: string;
      };

      // 1. Connection-specific start/end time check (legacy/provider sync interface)
      if (id && startTime && endTime) {
        const start = new Date(startTime);
        const end = new Date(endTime);
        if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
          const slots = await this.calendarService.getAvailability(id, tenantId, start, end);
          sendSuccess(res, { slots });
          return;
        }
      }

      // 2. Healthcare Dynamic Availability Engine (doctor & date search interface)
      if (doctorId && date) {
        // Lazy-load AvailabilityService with shared Prisma singleton
        let availabilityService = (this.calendarService as any).availabilityService;
        if (!availabilityService) {
          const { AvailabilityService } = require('../services/availability.service');
          const { prisma } = require('../../../shared/database/prisma');
          availabilityService = new AvailabilityService(prisma);
          (this.calendarService as any).availabilityService = availabilityService;
        }

        // Fetch clinic-level business hours from configuration (non-blocking — safe fallback)
        let clinicBusinessHours: Array<{ dayOfWeek: number; openTime: string; closeTime: string; isClosed: boolean }> | undefined;
        try {
          const { prisma } = require('../../../shared/database/prisma');

          const clinicId = req.user?.clinicId ?? null;

          // Find active configuration for this tenant (clinic-scoped or tenant-level fallback)
          let config = await prisma.configuration.findFirst({
            where: {
              tenantId,
              ...(clinicId ? { clinicId } : {}),
              isActive: true,
            },
            select: { business: true },
          });

          // Fallback to tenant-level config if no clinic-scoped one found
          if (!config && clinicId) {
            config = await prisma.configuration.findFirst({
              where: { tenantId, clinicId: null, isActive: true },
              select: { business: true },
            });
          }

          if (config?.business) {
            const biz = config.business as any;
            // Prefer businessHoursSchedule (canonical); fall back to businessHours array
            const hoursArr = Array.isArray(biz.businessHoursSchedule)
              ? biz.businessHoursSchedule
              : Array.isArray(biz.businessHours)
              ? biz.businessHours
              : [];

            if (hoursArr.length > 0) {
              clinicBusinessHours = hoursArr.filter(
                (h: any) =>
                  typeof h.dayOfWeek === 'number' &&
                  typeof h.isClosed === 'boolean',
              );
            }
          }
        } catch (configErr) {
          // Non-fatal: if config fetch fails, availability still works without clinic constraints
          console.warn('[CalendarController] Could not fetch clinic business hours for availability check:', (configErr as Error).message);
        }

        const result = await availabilityService.getAvailableSlots({
          tenantId,
          clinicId: req.user?.clinicId,
          doctorId,
          date,
          durationMinutes: durationMinutes ? parseInt(durationMinutes, 10) : 30,
          appointmentType,
          excludeAppointmentId,
          excludeUnavailable: excludeUnavailable === 'true',
          stepMinutes: stepMinutes ? parseInt(stepMinutes, 10) : 30,
          bufferMinutes: bufferMinutes ? parseInt(bufferMinutes, 10) : 0,
          timezone: (req.query.timezone as string) || (req.query.timeZone as string) || undefined,
          clinicBusinessHours,
        });
        sendSuccess(res, result);
        return;
      }

      // Fallback for ID-only or missing params
      if (id) {
        const slots = await this.calendarService.getAvailability(id, tenantId, new Date(), new Date(Date.now() + 86400000));
        sendSuccess(res, { slots });
        return;
      }

      res.status(422).json({
        success: false,
        error: { code: 'MISSING_PARAMETERS', message: 'doctorId and date (or id, startTime, endTime) query parameters are required.' },
      });
    } catch (err) {
      next(err);
    }
  };


  /** GET /api/v1/calendars */
  public listConnections = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = req.tenantId;
      if (!tenantId) {
        res.status(400).json({ success: false, error: { code: 'MISSING_TENANT_CONTEXT', message: 'Tenant context is missing.' } });
        return;
      }
      const requestId = req.requestId ?? '';
      const parsed = ListConnectionsSchema.safeParse(req.query);
      if (!parsed.success) {
        sendValidationError(res, parsed.error, requestId);
        return;
      }

      const connections = await this.calendarService.listConnections({
        tenantId,
        ...parsed.data,
      });

      sendSuccess(res, { connections });
    } catch (err) {
      next(err);
    }
  };

  /** GET /api/v1/calendars/public/:publicId */
  public getConnectionByPublicId = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = req.tenantId;
      if (!tenantId) {
        res.status(400).json({ success: false, error: { code: 'MISSING_TENANT_CONTEXT', message: 'Tenant context is missing.' } });
        return;
      }
      const { publicId } = req.params as { publicId: string };
      const connection = await this.calendarService.getConnectionByPublicId(publicId, tenantId);
      sendSuccess(res, { connection });
    } catch (err) {
      next(err);
    }
  };

  /** GET /api/v1/calendars/:id */
  public getConnection = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = req.tenantId;
      if (!tenantId) {
        res.status(400).json({ success: false, error: { code: 'MISSING_TENANT_CONTEXT', message: 'Tenant context is missing.' } });
        return;
      }
      const { id } = req.params as { id: string };
      const connection = await this.calendarService.getConnectionById(id, tenantId);
      sendSuccess(res, { connection });
    } catch (err) {
      next(err);
    }
  };

  /** POST /api/v1/calendars/webhooks/:provider */
  public processWebhook = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = req.tenantId;
      if (!tenantId) {
        res.status(400).json({ success: false, error: { code: 'MISSING_TENANT_CONTEXT', message: 'Tenant context is missing.' } });
        return;
      }
      const { provider } = req.params as { provider: CalendarProvider };
      const signature = (req.headers['x-calendar-signature'] || '') as string;

      await this.calendarService.processWebhook(provider, signature, req.body, tenantId);
      sendSuccess(res, { processed: true });
    } catch (err) {
      next(err);
    }
  };
}

// ---------------------------------------------------------------------------
// Module-level Error Handler
// ---------------------------------------------------------------------------

export function calendarErrorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (err instanceof CalendarError) {
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

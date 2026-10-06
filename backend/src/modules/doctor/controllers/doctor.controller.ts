/**
 * Doctor Controller
 *
 * Maps Express request/response vectors to the Doctor Service actions.
 */

import type { Request, Response, NextFunction } from 'express';
import type { IDoctorService } from '../interfaces/doctor.interfaces';
import { CreateDoctorSchema } from '../validators/create-doctor.validator';
import { UpdateDoctorSchema } from '../validators/update-doctor.validator';
import { UpdateDoctorStatusSchema } from '../validators/update-status.validator';
import { DoctorWorkingHoursListSchema } from '../validators/working-hours.validator';
import { DoctorLeavesListSchema } from '../validators/leaves.validator';
import { DoctorError } from '../errors/doctor.errors';
import type { DoctorStatus } from '../constants/doctor.constants';
import { ZodError } from 'zod';

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

import { DashboardController } from '../../dashboard/dashboard.controller';
import { prisma } from '../../../shared/database/prisma';

interface CachedDoctors {
  payload: any;
  expiresAt: number;
}

export class DoctorController {
  private static doctorCache = new Map<string, CachedDoctors>();
  private static readonly TTL_MS = 30000; // 30-second cache

  private async verifyDoctorModificationAccess(id: string, tenantId: string, req: Request): Promise<boolean> {
    if (req.user?.role !== 'doctor') return true;
    if (!req.user?.email) return false;
    const doc = await prisma.doctor.findFirst({
      where: { id, tenantId, email: req.user.email, deletedAt: null },
      select: { id: true },
    });
    return !!doc;
  }

  public static invalidateCache(tenantId?: string): void {
    if (tenantId) {
      for (const key of DoctorController.doctorCache.keys()) {
        if (key.startsWith(tenantId)) {
          DoctorController.doctorCache.delete(key);
        }
      }
      DashboardController.invalidateCache(tenantId);
    } else {
      DoctorController.doctorCache.clear();
      DashboardController.invalidateCache();
    }
  }

  constructor(private readonly doctorService: IDoctorService) {}

  public createDoctor = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = req.tenantId;
      if (!tenantId) {
        res.status(400).json({ success: false, error: { code: 'MISSING_TENANT_CONTEXT', message: 'Tenant context is missing.' } });
        return;
      }
      if (req.user?.role === 'doctor') {
        res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Doctors cannot create doctor profiles.' } });
        return;
      }
      const requestId = req.requestId ?? '';
      const parsed = CreateDoctorSchema.safeParse(req.body);
      if (!parsed.success) {
        sendValidationError(res, parsed.error, requestId);
        return;
      }

      const actorId = req.user?.userId ?? 'system';
      const doctor = await this.doctorService.createDoctor({
        ...parsed.data,
        tenantId,
        actorId,
        requestId,
      });

      DoctorController.invalidateCache(tenantId);
      sendSuccess(res, { doctor }, 201);
    } catch (err) {
      next(err);
    }
  };

  public updateDoctor = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = req.tenantId;
      if (!tenantId) {
        res.status(400).json({ success: false, error: { code: 'MISSING_TENANT_CONTEXT', message: 'Tenant context is missing.' } });
        return;
      }
      const requestId = req.requestId ?? '';
      const { id } = req.params as { id: string };

      const hasAccess = await this.verifyDoctorModificationAccess(id, tenantId, req);
      if (!hasAccess) {
        res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'You can only update your own doctor profile.' } });
        return;
      }

      const parsed = UpdateDoctorSchema.safeParse(req.body);
      if (!parsed.success) {
        sendValidationError(res, parsed.error, requestId);
        return;
      }

      const actorId = req.user?.userId ?? 'system';
      const doctor = await this.doctorService.updateDoctor({
        id,
        tenantId,
        ...parsed.data,
        actorId,
        requestId,
      });

      DoctorController.invalidateCache(tenantId);
      sendSuccess(res, { doctor });
    } catch (err) {
      next(err);
    }
  };

  public getDoctor = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = req.tenantId;
      if (!tenantId) {
        res.status(400).json({ success: false, error: { code: 'MISSING_TENANT_CONTEXT', message: 'Tenant context is missing.' } });
        return;
      }
      const { id } = req.params as { id: string };
      const doctor = await this.doctorService.getDoctorById(id, tenantId);
      sendSuccess(res, { doctor });
    } catch (err) {
      next(err);
    }
  };

  public getDoctorByPublicId = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = req.tenantId;
      if (!tenantId) {
        res.status(400).json({ success: false, error: { code: 'MISSING_TENANT_CONTEXT', message: 'Tenant context is missing.' } });
        return;
      }
      const { publicId } = req.params as { publicId: string };
      const doctor = await this.doctorService.getDoctorByPublicId(publicId, tenantId);
      sendSuccess(res, { doctor });
    } catch (err) {
      next(err);
    }
  };

  public listDoctors = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = req.tenantId;
      if (!tenantId) {
        res.status(400).json({ success: false, error: { code: 'MISSING_TENANT_CONTEXT', message: 'Tenant context is missing.' } });
        return;
      }
      const clinicId = req.query['clinicId'] as string | undefined;
      const status = req.query['status'] as DoctorStatus | undefined;
      const limit = req.query['limit'] ? parseInt(req.query['limit'] as string, 10) : undefined;
      const offset = req.query['offset'] ? parseInt(req.query['offset'] as string, 10) : undefined;

      const cacheKey = `${tenantId}:${clinicId || 'all'}:${status || 'all'}:${limit || 'none'}:${offset || 'none'}`;
      const now = Date.now();
      const cached = DoctorController.doctorCache.get(cacheKey);
      if (cached && cached.expiresAt > now) {
        if (typeof res.setHeader === 'function') {
          res.setHeader('Cache-Control', 'private, no-cache, max-age=0, must-revalidate');
          res.setHeader('Server-Timing', 'cache;desc="HIT"');
        }
        sendSuccess(res, cached.payload);
        return;
      }

      const doctors = await this.doctorService.listDoctors({
        tenantId,
        clinicId,
        status,
        limit,
        offset,
      });

      const payload = { doctors, total: doctors.length };
      DoctorController.doctorCache.set(cacheKey, {
        payload,
        expiresAt: now + DoctorController.TTL_MS,
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

      const parsed = UpdateDoctorStatusSchema.safeParse(req.body);
      if (!parsed.success) {
        sendValidationError(res, parsed.error, requestId);
        return;
      }

      const actorId = req.user?.userId ?? 'system';
      const doctor = await this.doctorService.transitionStatus(
        id,
        tenantId,
        parsed.data.status,
        actorId,
        requestId,
      );

      DoctorController.invalidateCache(tenantId);
      sendSuccess(res, { doctor });
    } catch (err) {
      next(err);
    }
  };

  public updateWorkingHours = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = req.tenantId;
      if (!tenantId) {
        res.status(400).json({ success: false, error: { code: 'MISSING_TENANT_CONTEXT', message: 'Tenant context is missing.' } });
        return;
      }
      const requestId = req.requestId ?? '';
      const { id } = req.params as { id: string };

      const hasAccess = await this.verifyDoctorModificationAccess(id, tenantId, req);
      if (!hasAccess) {
        res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'You can only update your own working hours.' } });
        return;
      }

      const parsed = DoctorWorkingHoursListSchema.safeParse(req.body);
      if (!parsed.success) {
        sendValidationError(res, parsed.error, requestId);
        return;
      }

      const actorId = req.user?.userId ?? 'system';
      const doctor = await this.doctorService.updateWorkingHours(
        id,
        tenantId,
        parsed.data.workingHours,
        actorId,
        requestId,
      );

      DoctorController.invalidateCache(tenantId);
      sendSuccess(res, { doctor });
    } catch (err) {
      next(err);
    }
  };

  public updateLeaves = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = req.tenantId;
      if (!tenantId) {
        res.status(400).json({ success: false, error: { code: 'MISSING_TENANT_CONTEXT', message: 'Tenant context is missing.' } });
        return;
      }
      const requestId = req.requestId ?? '';
      const { id } = req.params as { id: string };

      const hasAccess = await this.verifyDoctorModificationAccess(id, tenantId, req);
      if (!hasAccess) {
        res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'You can only update your own leaves.' } });
        return;
      }

      const parsed = DoctorLeavesListSchema.safeParse(req.body);
      if (!parsed.success) {
        sendValidationError(res, parsed.error, requestId);
        return;
      }

      const actorId = req.user?.userId ?? 'system';
      const doctor = await this.doctorService.updateLeaves(
        id,
        tenantId,
        parsed.data.leaves,
        actorId,
        requestId,
      );

      DoctorController.invalidateCache(tenantId);
      sendSuccess(res, { doctor });
    } catch (err) {
      next(err);
    }
  };

  public deleteDoctor = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = req.tenantId;
      if (!tenantId) {
        res.status(400).json({ success: false, error: { code: 'MISSING_TENANT_CONTEXT', message: 'Tenant context is missing.' } });
        return;
      }
      if (req.user?.role === 'doctor') {
        res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Doctors cannot delete doctor profiles.' } });
        return;
      }
      const requestId = req.requestId ?? '';
      const { id } = req.params as { id: string };
      const actorId = req.user?.userId ?? 'system';

      await this.doctorService.softDeleteDoctor(id, tenantId, actorId, requestId);
      DoctorController.invalidateCache(tenantId);
      sendSuccess(res, { deleted: true });
    } catch (err) {
      next(err);
    }
  };

  public restoreDoctor = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = req.tenantId;
      if (!tenantId) {
        res.status(400).json({ success: false, error: { code: 'MISSING_TENANT_CONTEXT', message: 'Tenant context is missing.' } });
        return;
      }
      if (req.user?.role === 'doctor') {
        res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Doctors cannot restore doctor profiles.' } });
        return;
      }
      const requestId = req.requestId ?? '';
      const { id } = req.params as { id: string };
      const actorId = req.user?.userId ?? 'system';

      const doctor = await this.doctorService.restoreDoctor(id, tenantId, actorId, requestId);
      DoctorController.invalidateCache(tenantId);
      sendSuccess(res, { doctor });
    } catch (err) {
      next(err);
    }
  };
}

export function doctorErrorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (err instanceof DoctorError) {
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

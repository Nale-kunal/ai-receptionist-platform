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

export class DoctorController {
  constructor(private readonly doctorService: IDoctorService) {}

  public createDoctor = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = req.tenantId;
      if (!tenantId) {
        res.status(400).json({ success: false, error: { code: 'MISSING_TENANT_CONTEXT', message: 'Tenant context is missing.' } });
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

      const doctors = await this.doctorService.listDoctors({
        tenantId,
        clinicId,
        status,
        limit,
        offset,
      });

      sendSuccess(res, { doctors, total: doctors.length });
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
      const requestId = req.requestId ?? '';
      const { id } = req.params as { id: string };
      const actorId = req.user?.userId ?? 'system';

      await this.doctorService.softDeleteDoctor(id, tenantId, actorId, requestId);
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
      const requestId = req.requestId ?? '';
      const { id } = req.params as { id: string };
      const actorId = req.user?.userId ?? 'system';

      const doctor = await this.doctorService.restoreDoctor(id, tenantId, actorId, requestId);
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

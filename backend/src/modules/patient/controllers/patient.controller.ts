/**
 * Patient Controller
 *
 * Maps Express request/response parameters to Patient Service actions.
 */

import type { Request, Response, NextFunction } from 'express';
import type { IPatientService } from '../interfaces/patient.interfaces';
import { CreatePatientSchema } from '../validators/create-patient.validator';
import { UpdatePatientSchema } from '../validators/update-patient.validator';
import { UpdatePatientStatusSchema } from '../validators/update-status.validator';
import { PatientError } from '../errors/patient.errors';
import type { PatientStatus } from '../constants/patient.constants';
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

export class PatientController {
  constructor(private readonly patientService: IPatientService) {}

  public createPatient = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = req.tenantId;
      if (!tenantId) {
        res.status(400).json({ success: false, error: { code: 'MISSING_TENANT_CONTEXT', message: 'Tenant context is missing.' } });
        return;
      }
      const requestId = req.requestId ?? '';
      const parsed = CreatePatientSchema.safeParse(req.body);
      if (!parsed.success) {
        sendValidationError(res, parsed.error, requestId);
        return;
      }

      const actorId = req.user?.userId ?? 'system';
      const patient = await this.patientService.createPatient({
        ...parsed.data,
        tenantId,
        actorId,
        requestId,
      });

      sendSuccess(res, { patient }, 201);
    } catch (err) {
      next(err);
    }
  };

  public updatePatient = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = req.tenantId;
      if (!tenantId) {
        res.status(400).json({ success: false, error: { code: 'MISSING_TENANT_CONTEXT', message: 'Tenant context is missing.' } });
        return;
      }
      const requestId = req.requestId ?? '';
      const { id } = req.params as { id: string };

      const parsed = UpdatePatientSchema.safeParse(req.body);
      if (!parsed.success) {
        sendValidationError(res, parsed.error, requestId);
        return;
      }

      const actorId = req.user?.userId ?? 'system';
      const patient = await this.patientService.updatePatient({
        id,
        tenantId,
        ...parsed.data,
        actorId,
        requestId,
      });

      sendSuccess(res, { patient });
    } catch (err) {
      next(err);
    }
  };

  public getPatient = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = req.tenantId;
      if (!tenantId) {
        res.status(400).json({ success: false, error: { code: 'MISSING_TENANT_CONTEXT', message: 'Tenant context is missing.' } });
        return;
      }
      const { id } = req.params as { id: string };
      const patient = await this.patientService.getPatientById(id, tenantId);
      sendSuccess(res, { patient });
    } catch (err) {
      next(err);
    }
  };

  public getPatientByPublicId = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = req.tenantId;
      if (!tenantId) {
        res.status(400).json({ success: false, error: { code: 'MISSING_TENANT_CONTEXT', message: 'Tenant context is missing.' } });
        return;
      }
      const { publicId } = req.params as { publicId: string };
      const patient = await this.patientService.getPatientByPublicId(publicId, tenantId);
      sendSuccess(res, { patient });
    } catch (err) {
      next(err);
    }
  };

  public listPatients = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = req.tenantId;
      if (!tenantId) {
        res.status(400).json({ success: false, error: { code: 'MISSING_TENANT_CONTEXT', message: 'Tenant context is missing.' } });
        return;
      }
      const clinicId = req.query['clinicId'] as string | undefined;
      const phone = req.query['phone'] as string | undefined;
      const email = req.query['email'] as string | undefined;
      const fullName = req.query['fullName'] as string | undefined;
      const search = (req.query['search'] || req.query['q']) as string | undefined;
      const status = req.query['status'] as PatientStatus | undefined;
      const limit = req.query['limit'] ? parseInt(req.query['limit'] as string, 10) : undefined;
      const offset = req.query['offset'] ? parseInt(req.query['offset'] as string, 10) : undefined;

      const patients = await this.patientService.listPatients({
        tenantId,
        clinicId,
        phone,
        email,
        fullName,
        search,
        status,
        limit,
        offset,
      });

      sendSuccess(res, { patients, total: patients.length });
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

      const parsed = UpdatePatientStatusSchema.safeParse(req.body);
      if (!parsed.success) {
        sendValidationError(res, parsed.error, requestId);
        return;
      }

      const actorId = req.user?.userId ?? 'system';
      const patient = await this.patientService.transitionStatus(
        id,
        tenantId,
        parsed.data.status,
        actorId,
        requestId,
      );

      sendSuccess(res, { patient });
    } catch (err) {
      next(err);
    }
  };

  public deletePatient = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = req.tenantId;
      if (!tenantId) {
        res.status(400).json({ success: false, error: { code: 'MISSING_TENANT_CONTEXT', message: 'Tenant context is missing.' } });
        return;
      }
      const requestId = req.requestId ?? '';
      const { id } = req.params as { id: string };
      const actorId = req.user?.userId ?? 'system';

      await this.patientService.softDeletePatient(id, tenantId, actorId, requestId);
      sendSuccess(res, { deleted: true });
    } catch (err) {
      next(err);
    }
  };

  public restorePatient = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = req.tenantId;
      if (!tenantId) {
        res.status(400).json({ success: false, error: { code: 'MISSING_TENANT_CONTEXT', message: 'Tenant context is missing.' } });
        return;
      }
      const requestId = req.requestId ?? '';
      const { id } = req.params as { id: string };
      const actorId = req.user?.userId ?? 'system';

      const patient = await this.patientService.restorePatient(id, tenantId, actorId, requestId);
      sendSuccess(res, { patient });
    } catch (err) {
      next(err);
    }
  };
}

export function patientErrorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (err instanceof PatientError) {
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

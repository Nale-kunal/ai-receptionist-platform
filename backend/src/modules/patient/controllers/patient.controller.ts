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

interface CachedPatients {
  payload: any;
  expiresAt: number;
}

export class PatientController {
  private static patientCache = new Map<string, CachedPatients>();
  private static readonly TTL_MS = 15000; // 15-second micro-cache

  private async resolveDoctorId(tenantId: string, email?: string): Promise<string | null> {
    if (!email) return null;
    const doc = await prisma.doctor.findFirst({
      where: { tenantId, email, deletedAt: null },
      select: { id: true },
    });
    return doc?.id || null;
  }

  private async verifyDoctorPatientAccess(patientId: string, tenantId: string, req: Request): Promise<boolean> {
    if (req.user?.role !== 'doctor') return true;
    const doctorId = await this.resolveDoctorId(tenantId, req.user?.email);
    if (!doctorId) return false;

    const count = await prisma.appointment.count({
      where: {
        tenantId,
        patientId,
        doctorId,
        deletedAt: null,
      },
    });
    return count > 0;
  }

  public static invalidateCache(tenantId?: string): void {
    if (tenantId) {
      for (const key of PatientController.patientCache.keys()) {
        if (key.startsWith(tenantId)) {
          PatientController.patientCache.delete(key);
        }
      }
      DashboardController.invalidateCache(tenantId);
    } else {
      PatientController.patientCache.clear();
      DashboardController.invalidateCache();
    }
  }

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

      PatientController.invalidateCache(tenantId);
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

      PatientController.invalidateCache(tenantId);
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

      const hasAccess = await this.verifyDoctorPatientAccess(id, tenantId, req);
      if (!hasAccess) {
        res.status(404).json({ success: false, error: { code: 'PATIENT_NOT_FOUND', message: 'Patient not found.' } });
        return;
      }

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

      if (req.user?.role === 'doctor') {
        const pRecord = await prisma.patient.findFirst({
          where: { publicId, tenantId, deletedAt: null },
          select: { id: true },
        });
        if (!pRecord || !(await this.verifyDoctorPatientAccess(pRecord.id, tenantId, req))) {
          res.status(404).json({ success: false, error: { code: 'PATIENT_NOT_FOUND', message: 'Patient not found.' } });
          return;
        }
      }

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

      const userRole = req.user?.role;
      const userEmail = req.user?.email;
      const isDoctor = userRole === 'doctor';

      let doctorId: string | null = null;
      if (isDoctor) {
        doctorId = await this.resolveDoctorId(tenantId, userEmail);
      }

      const cacheKey = `${tenantId}:${isDoctor ? `doctor:${doctorId || 'none'}` : 'all'}:${clinicId || 'all'}:${phone || ''}:${email || ''}:${fullName || ''}:${search || ''}:${status || 'all'}:${limit || 'none'}:${offset || 'none'}`;
      const now = Date.now();
      const cached = PatientController.patientCache.get(cacheKey);
      if (cached && cached.expiresAt > now) {
        if (typeof res.setHeader === 'function') {
          res.setHeader('Cache-Control', 'private, no-cache, max-age=0, must-revalidate');
          res.setHeader('Server-Timing', 'cache;desc="HIT"');
        }
        sendSuccess(res, cached.payload);
        return;
      }

      if (isDoctor) {
        if (!doctorId) {
          sendSuccess(res, { patients: [], total: 0 });
          return;
        }

        const patientWhere: any = {
          tenantId,
          deletedAt: null,
          appointments: {
            some: {
              doctorId,
              deletedAt: null,
            },
          },
        };

        if (clinicId) patientWhere.clinicId = clinicId;
        if (phone) patientWhere.phone = { contains: phone };
        if (email) patientWhere.email = { contains: email, mode: 'insensitive' };
        if (fullName) patientWhere.fullName = { contains: fullName, mode: 'insensitive' };
        if (search) {
          patientWhere.OR = [
            { fullName: { contains: search, mode: 'insensitive' } },
            { phone: { contains: search } },
            { email: { contains: search, mode: 'insensitive' } },
          ];
        }
        if (status) patientWhere.status = status;

        const patientsRaw = await prisma.patient.findMany({
          where: patientWhere,
          take: limit ?? 50,
          skip: offset ?? 0,
          orderBy: { createdAt: 'desc' },
        });

        const total = await prisma.patient.count({ where: patientWhere });
        const patients = patientsRaw.map((p) => ({
          id: p.id,
          publicId: p.publicId,
          tenantId: p.tenantId,
          clinicId: p.clinicId,
          fullName: p.fullName,
          firstName: p.firstName ?? undefined,
          lastName: p.lastName ?? undefined,
          mrn: p.mrn ?? undefined,
          phone: p.phone,
          email: p.email ?? undefined,
          dateOfBirth: p.dateOfBirth?.toISOString() ?? undefined,
          gender: p.gender ?? undefined,
          preferredLanguage: p.preferredLanguage,
          preferredContactMethod: p.preferredContactMethod as any,
          status: p.status as any,
          emergencyContact: p.emergencyContact as any,
          address: p.address as any,
          notes: p.notes ?? undefined,
          smsEnabled: p.smsEnabled,
          emailEnabled: p.emailEnabled,
          createdAt: p.createdAt.toISOString(),
          updatedAt: p.updatedAt.toISOString(),
        }));

        const payload = { patients, total };
        PatientController.patientCache.set(cacheKey, {
          payload,
          expiresAt: now + PatientController.TTL_MS,
        });

        if (typeof res.setHeader === 'function') {
          res.setHeader('Cache-Control', 'private, no-cache, max-age=0, must-revalidate');
        }
        sendSuccess(res, payload);
        return;
      }

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

      const payload = { patients, total: patients.length };
      PatientController.patientCache.set(cacheKey, {
        payload,
        expiresAt: now + PatientController.TTL_MS,
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

      PatientController.invalidateCache(tenantId);
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
      PatientController.invalidateCache(tenantId);
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
      PatientController.invalidateCache(tenantId);
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

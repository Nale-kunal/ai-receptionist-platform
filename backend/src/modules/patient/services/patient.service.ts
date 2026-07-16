/**
 * Patient Service
 *
 * Implements business rules for patient CRUD, status transitions, and audit events.
 */

import type {
  IPatientService,
  IPatientRepository,
  CreatePatientParams,
  UpdatePatientParams,
} from '../interfaces/patient.interfaces';
import type { IPatientEventPublisher } from '../events/patient-event.publisher';
import type { SafePatient } from '../types/patient.types';
import { PatientStatus, ContactMethod } from '../constants/patient.constants';
import {
  PatientNotFoundError,
  PatientIsolationViolationError,
  PatientArchivedError,
  DuplicatePatientError,
  InvalidPatientStatusTransitionError,
  ClinicTenantMismatchError,
  PatientError,
} from '../errors/patient.errors';
import {
  EVENT_PATIENT_CREATED,
  EVENT_PATIENT_UPDATED,
  EVENT_PATIENT_ACTIVATED,
  EVENT_PATIENT_DEACTIVATED,
  EVENT_PATIENT_BLOCKED,
  EVENT_PATIENT_ARCHIVED,
  EVENT_PATIENT_DELETED,
  EVENT_PATIENT_RESTORED,
} from '../events/patient.events';
import {
  PATIENT_STATUS_ACTIVE,
  PATIENT_STATUS_INACTIVE,
  PATIENT_STATUS_BLOCKED,
  PATIENT_STATUS_ARCHIVED,
  PATIENT_STATUS_DELETED,
  CONTACT_METHOD_SMS,
} from '../constants/patient.constants';

export class PatientService implements IPatientService {
  constructor(
    private readonly repository: IPatientRepository,
    private readonly publisher: IPatientEventPublisher,
  ) {}

  public async createPatient(params: CreatePatientParams): Promise<SafePatient> {
    // 1. Clinic belongs to Tenant validation
    const clinicValid = await this.repository.clinicBelongsToTenant(params.clinicId, params.tenantId);
    if (!clinicValid) {
      throw new ClinicTenantMismatchError();
    }

    // 2. Duplicate detection: phone must be unique within clinic
    const existingPhone = await this.repository.findByPhone(params.phone, params.clinicId);
    if (existingPhone) {
      throw new DuplicatePatientError('phone', params.phone);
    }

    // 3. Duplicate detection: email must be unique within clinic (if provided)
    if (params.email) {
      const existingEmail = await this.repository.findByEmail(params.email, params.clinicId);
      if (existingEmail) {
        throw new DuplicatePatientError('email', params.email);
      }
    }

    let parsedDob: Date | null = null;
    if (params.dateOfBirth) {
      parsedDob = typeof params.dateOfBirth === 'string' ? new Date(params.dateOfBirth) : params.dateOfBirth;
    }

    const created = await this.repository.create({
      tenantId: params.tenantId,
      clinicId: params.clinicId,
      fullName: params.fullName,
      phone: params.phone,
      email: params.email,
      dateOfBirth: parsedDob,
      gender: params.gender,
      preferredLanguage: params.preferredLanguage ?? 'en',
      preferredContactMethod: params.preferredContactMethod ?? CONTACT_METHOD_SMS,
      status: PATIENT_STATUS_ACTIVE,
      emergencyContact: params.emergencyContact,
    });

    const safe = this.mapToSafePatient(created);

    await this.publisher.publish({
      type: EVENT_PATIENT_CREATED,
      payload: {
        tenantId: safe.tenantId,
        clinicId: safe.clinicId,
        patientId: safe.id,
        actorId: params.actorId,
        requestId: params.requestId,
        occurredAt: new Date(),
        fullName: params.fullName,
        phone: params.phone,
        email: params.email,
      },
    });

    return safe;
  }

  public async updatePatient(params: UpdatePatientParams): Promise<SafePatient> {
    const existing = await this.repository.findById(params.id);
    if (!existing) {
      throw new PatientNotFoundError(params.id);
    }

    const safeExisting = this.mapToSafePatient(existing);
    if (safeExisting.tenantId !== params.tenantId) {
      throw new PatientIsolationViolationError();
    }

    if (safeExisting.status === PATIENT_STATUS_DELETED) {
      throw new PatientNotFoundError(params.id);
    }

    if (safeExisting.status === PATIENT_STATUS_ARCHIVED) {
      throw new PatientArchivedError();
    }

    const updateData: any = {};
    const targetClinicId = params.clinicId ?? safeExisting.clinicId;

    if (params.clinicId !== undefined && params.clinicId !== safeExisting.clinicId) {
      const clinicValid = await this.repository.clinicBelongsToTenant(params.clinicId, params.tenantId);
      if (!clinicValid) {
        throw new ClinicTenantMismatchError();
      }
      updateData.clinicId = params.clinicId;
    }

    // Phone changed or clinic changed: check uniqueness
    if (
      (params.phone !== undefined && params.phone !== safeExisting.phone) ||
      (params.clinicId !== undefined && params.clinicId !== safeExisting.clinicId)
    ) {
      const phoneToCheck = params.phone ?? safeExisting.phone;
      const existingPhone = await this.repository.findByPhone(phoneToCheck, targetClinicId);
      if (existingPhone && (existingPhone as any).id !== params.id) {
        throw new DuplicatePatientError('phone', phoneToCheck);
      }
      if (params.phone !== undefined) {
        updateData.phone = params.phone;
      }
    }

    // Email changed or clinic changed: check uniqueness
    if (
      (params.email !== undefined && params.email !== safeExisting.email) ||
      (params.clinicId !== undefined && params.clinicId !== safeExisting.clinicId)
    ) {
      const emailToCheck = params.email ?? safeExisting.email;
      if (emailToCheck) {
        const existingEmail = await this.repository.findByEmail(emailToCheck, targetClinicId);
        if (existingEmail && (existingEmail as any).id !== params.id) {
          throw new DuplicatePatientError('email', emailToCheck);
        }
      }
      if (params.email !== undefined) {
        updateData.email = params.email;
      }
    }

    if (params.fullName !== undefined) updateData.fullName = params.fullName;
    if (params.gender !== undefined) updateData.gender = params.gender;
    if (params.preferredLanguage !== undefined) updateData.preferredLanguage = params.preferredLanguage;
    if (params.preferredContactMethod !== undefined) updateData.preferredContactMethod = params.preferredContactMethod;
    if (params.emergencyContact !== undefined) updateData.emergencyContact = params.emergencyContact;

    if (params.dateOfBirth !== undefined) {
      updateData.dateOfBirth =
        typeof params.dateOfBirth === 'string' && params.dateOfBirth
          ? new Date(params.dateOfBirth)
          : params.dateOfBirth ?? null;
    }

    const updated = await this.repository.update(params.id, updateData);
    const safeUpdated = this.mapToSafePatient(updated);

    const changedFields = Object.keys(updateData);
    await this.publisher.publish({
      type: EVENT_PATIENT_UPDATED,
      payload: {
        tenantId: safeUpdated.tenantId,
        clinicId: safeUpdated.clinicId,
        patientId: safeUpdated.id,
        actorId: params.actorId,
        requestId: params.requestId,
        occurredAt: new Date(),
        changedFields,
        previous: safeExisting,
        current: safeUpdated,
      },
    });

    return safeUpdated;
  }

  public async getPatientById(id: string, tenantId: string): Promise<SafePatient> {
    const record = await this.repository.findById(id);
    if (!record) {
      throw new PatientNotFoundError(id);
    }
    const safe = this.mapToSafePatient(record);
    if (safe.tenantId !== tenantId) {
      throw new PatientIsolationViolationError();
    }
    return safe;
  }

  public async getPatientByPublicId(publicId: string, tenantId: string): Promise<SafePatient> {
    const record = await this.repository.findByPublicId(publicId);
    if (!record) {
      throw new PatientNotFoundError();
    }
    const safe = this.mapToSafePatient(record);
    if (safe.tenantId !== tenantId) {
      throw new PatientIsolationViolationError();
    }
    return safe;
  }

  public async listPatients(params: {
    tenantId: string;
    clinicId?: string;
    phone?: string;
    email?: string;
    fullName?: string;
    status?: PatientStatus;
    limit?: number;
    offset?: number;
  }): Promise<SafePatient[]> {
    const records = await this.repository.findMany({
      tenantId: params.tenantId,
      clinicId: params.clinicId,
      phone: params.phone,
      email: params.email,
      fullName: params.fullName,
      status: params.status,
      limit: params.limit,
      offset: params.offset,
    });
    return records.map((r) => this.mapToSafePatient(r));
  }

  public async transitionStatus(
    id: string,
    tenantId: string,
    targetStatus: PatientStatus,
    actorId: string,
    requestId: string,
  ): Promise<SafePatient> {
    const record = await this.repository.findById(id, targetStatus === PATIENT_STATUS_ACTIVE);
    if (!record) {
      throw new PatientNotFoundError(id);
    }
    const safe = this.mapToSafePatient(record);
    if (safe.tenantId !== tenantId) {
      throw new PatientIsolationViolationError();
    }

    const currentStatus = safe.status;

    const valid = this.validateTransition(currentStatus, targetStatus);
    if (!valid) {
      throw new InvalidPatientStatusTransitionError(currentStatus, targetStatus);
    }

    const updated = await this.repository.update(id, { status: targetStatus });
    const safeUpdated = this.mapToSafePatient(updated);

    const occurredAt = new Date();
    const payload = {
      tenantId: safeUpdated.tenantId,
      clinicId: safeUpdated.clinicId,
      patientId: safeUpdated.id,
      actorId,
      requestId,
      occurredAt,
    };

    if (targetStatus === PATIENT_STATUS_ACTIVE) {
      await this.publisher.publish({ type: EVENT_PATIENT_ACTIVATED, payload });
    } else if (targetStatus === PATIENT_STATUS_INACTIVE) {
      await this.publisher.publish({ type: EVENT_PATIENT_DEACTIVATED, payload });
    } else if (targetStatus === PATIENT_STATUS_BLOCKED) {
      await this.publisher.publish({ type: EVENT_PATIENT_BLOCKED, payload });
    } else if (targetStatus === PATIENT_STATUS_ARCHIVED) {
      await this.publisher.publish({ type: EVENT_PATIENT_ARCHIVED, payload });
    }

    return safeUpdated;
  }

  public async softDeletePatient(
    id: string,
    tenantId: string,
    actorId: string,
    requestId: string,
  ): Promise<void> {
    const record = await this.repository.findById(id);
    if (!record) {
      throw new PatientNotFoundError(id);
    }
    const safe = this.mapToSafePatient(record);
    if (safe.tenantId !== tenantId) {
      throw new PatientIsolationViolationError();
    }

    await this.repository.update(id, {
      status: PATIENT_STATUS_DELETED,
      deletedAt: new Date(),
    });

    await this.publisher.publish({
      type: EVENT_PATIENT_DELETED,
      payload: {
        tenantId,
        clinicId: safe.clinicId,
        patientId: id,
        actorId,
        requestId,
        occurredAt: new Date(),
      },
    });
  }

  public async restorePatient(
    id: string,
    tenantId: string,
    actorId: string,
    requestId: string,
  ): Promise<SafePatient> {
    const record = await this.repository.findById(id, true);
    if (!record) {
      throw new PatientNotFoundError(id);
    }
    const safe = this.mapToSafePatient(record);
    if (safe.tenantId !== tenantId) {
      throw new PatientIsolationViolationError();
    }

    if (safe.status !== PATIENT_STATUS_DELETED) {
      throw new PatientError('Patient is not in deleted status.', 'PATIENT_NOT_DELETED', 400);
    }

    // Verify phone uniqueness before restoring (could have been taken since soft deletion)
    const existingPhone = await this.repository.findByPhone(safe.phone, safe.clinicId);
    if (existingPhone && (existingPhone as any).id !== id) {
      throw new DuplicatePatientError('phone', safe.phone);
    }

    const restored = await this.repository.update(id, {
      status: PATIENT_STATUS_ACTIVE,
      deletedAt: null,
    });

    const safeRestored = this.mapToSafePatient(restored);

    await this.publisher.publish({
      type: EVENT_PATIENT_RESTORED,
      payload: {
        tenantId,
        clinicId: safeRestored.clinicId,
        patientId: id,
        actorId,
        requestId,
        occurredAt: new Date(),
      },
    });

    await this.publisher.publish({
      type: EVENT_PATIENT_ACTIVATED,
      payload: {
        tenantId,
        clinicId: safeRestored.clinicId,
        patientId: id,
        actorId,
        requestId,
        occurredAt: new Date(),
      },
    });

    return safeRestored;
  }

  private validateTransition(from: PatientStatus, to: PatientStatus): boolean {
    if (from === PATIENT_STATUS_DELETED) {
      return to === PATIENT_STATUS_ACTIVE;
    }

    switch (from) {
      case PATIENT_STATUS_ACTIVE:
        return (
          to === PATIENT_STATUS_INACTIVE ||
          to === PATIENT_STATUS_BLOCKED ||
          to === PATIENT_STATUS_ARCHIVED ||
          to === PATIENT_STATUS_DELETED
        );
      case PATIENT_STATUS_INACTIVE:
        return (
          to === PATIENT_STATUS_ACTIVE ||
          to === PATIENT_STATUS_BLOCKED ||
          to === PATIENT_STATUS_DELETED
        );
      case PATIENT_STATUS_BLOCKED:
        return (
          to === PATIENT_STATUS_ACTIVE ||
          to === PATIENT_STATUS_INACTIVE ||
          to === PATIENT_STATUS_DELETED
        );
      case PATIENT_STATUS_ARCHIVED:
        return to === PATIENT_STATUS_ACTIVE || to === PATIENT_STATUS_DELETED;
      default:
        return false;
    }
  }

  private mapToSafePatient(dbRecord: any): SafePatient {
    return {
      id: dbRecord.id,
      publicId: dbRecord.publicId,
      tenantId: dbRecord.tenantId,
      clinicId: dbRecord.clinicId,
      fullName: dbRecord.fullName,
      phone: dbRecord.phone,
      email: dbRecord.email,
      dateOfBirth: dbRecord.dateOfBirth,
      gender: dbRecord.gender,
      preferredLanguage: dbRecord.preferredLanguage,
      preferredContactMethod: dbRecord.preferredContactMethod as ContactMethod,
      status: dbRecord.status as PatientStatus,
      emergencyContact: dbRecord.emergencyContact ? (dbRecord.emergencyContact as any) : null,
      createdAt: dbRecord.createdAt,
      updatedAt: dbRecord.updatedAt,
      deletedAt: dbRecord.deletedAt,
    };
  }
}

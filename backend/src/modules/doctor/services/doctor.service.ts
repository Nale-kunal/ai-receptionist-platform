/**
 * Doctor Service
 *
 * Implements business rules for doctor CRUD, status transitions, working hours,
 * leaves/exceptions, and event publication.
 */

import type {
  IDoctorService,
  IDoctorRepository,
  CreateDoctorParams,
  UpdateDoctorParams,
} from '../interfaces/doctor.interfaces';
import type { IDoctorEventPublisher } from '../events/doctor-event.publisher';
import type { SafeDoctor, WorkingHourInterval, DoctorLeaveInterval } from '../types/doctor.types';
import { DoctorStatus } from '../constants/doctor.constants';
import {
  DoctorNotFoundError,
  DoctorIsolationViolationError,
  DoctorArchivedError,
  DuplicateLicenseNumberError,
  InvalidDoctorStatusTransitionError,
  ClinicTenantMismatchError,
  DoctorError,
} from '../errors/doctor.errors';
import {
  EVENT_DOCTOR_CREATED,
  EVENT_DOCTOR_UPDATED,
  EVENT_DOCTOR_ACTIVATED,
  EVENT_DOCTOR_DEACTIVATED,
  EVENT_DOCTOR_ARCHIVED,
  EVENT_DOCTOR_DELETED,
  EVENT_DOCTOR_RESTORED,
  EVENT_DOCTOR_AVAILABILITY_UPDATED,
  EVENT_DOCTOR_WORKING_HOURS_UPDATED,
  EVENT_DOCTOR_CLINIC_CHANGED,
} from '../events/doctor.events';
import {
  DOCTOR_STATUS_ACTIVE,
  DOCTOR_STATUS_INACTIVE,
  DOCTOR_STATUS_UNAVAILABLE,
  DOCTOR_STATUS_ARCHIVED,
  DOCTOR_STATUS_DELETED,
} from '../constants/doctor.constants';

export class DoctorService implements IDoctorService {
  constructor(
    private readonly repository: IDoctorRepository,
    private readonly publisher: IDoctorEventPublisher,
  ) {}

  public async createDoctor(params: CreateDoctorParams): Promise<SafeDoctor> {
    // 1. Clinic belongs to Tenant validation
    const clinicValid = await this.repository.clinicBelongsToTenant(params.clinicId, params.tenantId);
    if (!clinicValid) {
      throw new ClinicTenantMismatchError();
    }

    // 2. License number uniqueness validation within tenant
    if (params.licenseNumber) {
      const existingLicense = await this.repository.findByLicenseNumber(params.licenseNumber, params.tenantId);
      if (existingLicense) {
        throw new DuplicateLicenseNumberError(params.licenseNumber);
      }
    }

    const created = await this.repository.create({
      tenantId: params.tenantId,
      clinicId: params.clinicId,
      fullName: params.fullName,
      displayName: params.displayName,
      specialization: params.specialization,
      licenseNumber: params.licenseNumber,
      biography: params.biography,
      email: params.email,
      phone: params.phone,
      status: DOCTOR_STATUS_ACTIVE,
      profilePhoto: params.profilePhoto,
      workingHours: params.workingHours ?? [],
      leaves: params.leaves ?? [],
    });

    const safe = this.mapToSafeDoctor(created);

    await this.publisher.publish({
      type: EVENT_DOCTOR_CREATED,
      payload: {
        tenantId: safe.tenantId,
        clinicId: safe.clinicId,
        doctorId: safe.id,
        actorId: params.actorId,
        requestId: params.requestId,
        occurredAt: new Date(),
        fullName: params.fullName,
        displayName: params.displayName,
        specialization: params.specialization,
      },
    });

    return safe;
  }

  public async updateDoctor(params: UpdateDoctorParams): Promise<SafeDoctor> {
    const existing = await this.repository.findById(params.id);
    if (!existing) {
      throw new DoctorNotFoundError(params.id);
    }

    const safeExisting = this.mapToSafeDoctor(existing);
    if (safeExisting.tenantId !== params.tenantId) {
      throw new DoctorIsolationViolationError();
    }

    if (safeExisting.status === DOCTOR_STATUS_DELETED) {
      throw new DoctorNotFoundError(params.id);
    }

    if (safeExisting.status === DOCTOR_STATUS_ARCHIVED) {
      throw new DoctorArchivedError();
    }

    const updateData: any = {};
    let clinicChanged = false;
    let previousClinicId = safeExisting.clinicId;

    if (params.clinicId !== undefined && params.clinicId !== safeExisting.clinicId) {
      const clinicValid = await this.repository.clinicBelongsToTenant(params.clinicId, params.tenantId);
      if (!clinicValid) {
        throw new ClinicTenantMismatchError();
      }
      updateData.clinicId = params.clinicId;
      clinicChanged = true;
    }

    if (params.licenseNumber !== undefined && params.licenseNumber !== safeExisting.licenseNumber) {
      if (params.licenseNumber) {
        const existingLicense = await this.repository.findByLicenseNumber(params.licenseNumber, params.tenantId);
        if (existingLicense && (existingLicense as any).id !== params.id) {
          throw new DuplicateLicenseNumberError(params.licenseNumber);
        }
      }
      updateData.licenseNumber = params.licenseNumber;
    }

    if (params.fullName !== undefined) updateData.fullName = params.fullName;
    if (params.displayName !== undefined) updateData.displayName = params.displayName;
    if (params.specialization !== undefined) updateData.specialization = params.specialization;
    if (params.biography !== undefined) updateData.biography = params.biography;
    if (params.email !== undefined) updateData.email = params.email;
    if (params.phone !== undefined) updateData.phone = params.phone;
    if (params.profilePhoto !== undefined) updateData.profilePhoto = params.profilePhoto;

    const updated = await this.repository.update(params.id, updateData);
    const safeUpdated = this.mapToSafeDoctor(updated);

    const occurredAt = new Date();
    const payload = {
      tenantId: safeUpdated.tenantId,
      clinicId: safeUpdated.clinicId,
      doctorId: safeUpdated.id,
      actorId: params.actorId,
      requestId: params.requestId,
      occurredAt,
    };

    if (clinicChanged) {
      await this.publisher.publish({
        type: EVENT_DOCTOR_CLINIC_CHANGED,
        payload: {
          ...payload,
          previousClinicId,
          newClinicId: safeUpdated.clinicId,
        },
      });
    }

    const changedFields = Object.keys(updateData);
    await this.publisher.publish({
      type: EVENT_DOCTOR_UPDATED,
      payload: {
        ...payload,
        changedFields,
        previous: safeExisting,
        current: safeUpdated,
      },
    });

    return safeUpdated;
  }

  public async getDoctorById(id: string, tenantId: string): Promise<SafeDoctor> {
    const record = await this.repository.findById(id);
    if (!record) {
      throw new DoctorNotFoundError(id);
    }
    const safe = this.mapToSafeDoctor(record);
    if (safe.tenantId !== tenantId) {
      throw new DoctorIsolationViolationError();
    }
    return safe;
  }

  public async getDoctorByPublicId(publicId: string, tenantId: string): Promise<SafeDoctor> {
    const record = await this.repository.findByPublicId(publicId);
    if (!record) {
      throw new DoctorNotFoundError();
    }
    const safe = this.mapToSafeDoctor(record);
    if (safe.tenantId !== tenantId) {
      throw new DoctorIsolationViolationError();
    }
    return safe;
  }

  public async listDoctors(params: {
    tenantId: string;
    clinicId?: string;
    status?: DoctorStatus;
    limit?: number;
    offset?: number;
  }): Promise<SafeDoctor[]> {
    const records = await this.repository.findMany({
      tenantId: params.tenantId,
      clinicId: params.clinicId,
      status: params.status,
      limit: params.limit,
      offset: params.offset,
    });
    return records.map((r) => this.mapToSafeDoctor(r));
  }

  public async transitionStatus(
    id: string,
    tenantId: string,
    targetStatus: DoctorStatus,
    actorId: string,
    requestId: string,
  ): Promise<SafeDoctor> {
    const record = await this.repository.findById(id, targetStatus === DOCTOR_STATUS_ACTIVE);
    if (!record) {
      throw new DoctorNotFoundError(id);
    }
    const safe = this.mapToSafeDoctor(record);
    if (safe.tenantId !== tenantId) {
      throw new DoctorIsolationViolationError();
    }

    const currentStatus = safe.status;

    // Validate state machine transitions
    const valid = this.validateTransition(currentStatus, targetStatus);
    if (!valid) {
      throw new InvalidDoctorStatusTransitionError(currentStatus, targetStatus);
    }

    const updated = await this.repository.update(id, { status: targetStatus });
    const safeUpdated = this.mapToSafeDoctor(updated);

    const occurredAt = new Date();
    const payload = {
      tenantId: safeUpdated.tenantId,
      clinicId: safeUpdated.clinicId,
      doctorId: safeUpdated.id,
      actorId,
      requestId,
      occurredAt,
    };

    if (targetStatus === DOCTOR_STATUS_ACTIVE) {
      await this.publisher.publish({ type: EVENT_DOCTOR_ACTIVATED, payload });
    } else if (targetStatus === DOCTOR_STATUS_INACTIVE || targetStatus === DOCTOR_STATUS_UNAVAILABLE) {
      await this.publisher.publish({
        type: EVENT_DOCTOR_DEACTIVATED,
        payload: { ...payload, reasonStatus: targetStatus },
      });
    } else if (targetStatus === DOCTOR_STATUS_ARCHIVED) {
      await this.publisher.publish({ type: EVENT_DOCTOR_ARCHIVED, payload });
    }

    return safeUpdated;
  }

  public async updateWorkingHours(
    id: string,
    tenantId: string,
    workingHours: WorkingHourInterval[],
    actorId: string,
    requestId: string,
  ): Promise<SafeDoctor> {
    const record = await this.repository.findById(id);
    if (!record) {
      throw new DoctorNotFoundError(id);
    }
    const safe = this.mapToSafeDoctor(record);
    if (safe.tenantId !== tenantId) {
      throw new DoctorIsolationViolationError();
    }

    if (safe.status === DOCTOR_STATUS_DELETED) {
      throw new DoctorNotFoundError(id);
    }
    if (safe.status === DOCTOR_STATUS_ARCHIVED) {
      throw new DoctorArchivedError();
    }

    const updated = await this.repository.update(id, { workingHours });
    const safeUpdated = this.mapToSafeDoctor(updated);

    await this.publisher.publish({
      type: EVENT_DOCTOR_WORKING_HOURS_UPDATED,
      payload: {
        tenantId: safeUpdated.tenantId,
        clinicId: safeUpdated.clinicId,
        doctorId: safeUpdated.id,
        actorId,
        requestId,
        occurredAt: new Date(),
        workingHours,
      },
    });

    return safeUpdated;
  }

  public async updateLeaves(
    id: string,
    tenantId: string,
    leaves: DoctorLeaveInterval[],
    actorId: string,
    requestId: string,
  ): Promise<SafeDoctor> {
    const record = await this.repository.findById(id);
    if (!record) {
      throw new DoctorNotFoundError(id);
    }
    const safe = this.mapToSafeDoctor(record);
    if (safe.tenantId !== tenantId) {
      throw new DoctorIsolationViolationError();
    }

    if (safe.status === DOCTOR_STATUS_DELETED) {
      throw new DoctorNotFoundError(id);
    }
    if (safe.status === DOCTOR_STATUS_ARCHIVED) {
      throw new DoctorArchivedError();
    }

    const updated = await this.repository.update(id, { leaves });
    const safeUpdated = this.mapToSafeDoctor(updated);

    await this.publisher.publish({
      type: EVENT_DOCTOR_AVAILABILITY_UPDATED,
      payload: {
        tenantId: safeUpdated.tenantId,
        clinicId: safeUpdated.clinicId,
        doctorId: safeUpdated.id,
        actorId,
        requestId,
        occurredAt: new Date(),
        leaves,
      },
    });

    return safeUpdated;
  }

  public async softDeleteDoctor(
    id: string,
    tenantId: string,
    actorId: string,
    requestId: string,
  ): Promise<void> {
    const record = await this.repository.findById(id);
    if (!record) {
      throw new DoctorNotFoundError(id);
    }
    const safe = this.mapToSafeDoctor(record);
    if (safe.tenantId !== tenantId) {
      throw new DoctorIsolationViolationError();
    }

    await this.repository.update(id, {
      status: DOCTOR_STATUS_DELETED,
      deletedAt: new Date(),
    });

    await this.publisher.publish({
      type: EVENT_DOCTOR_DELETED,
      payload: {
        tenantId,
        clinicId: safe.clinicId,
        doctorId: id,
        actorId,
        requestId,
        occurredAt: new Date(),
      },
    });
  }

  public async restoreDoctor(
    id: string,
    tenantId: string,
    actorId: string,
    requestId: string,
  ): Promise<SafeDoctor> {
    const record = await this.repository.findById(id, true);
    if (!record) {
      throw new DoctorNotFoundError(id);
    }
    const safe = this.mapToSafeDoctor(record);
    if (safe.tenantId !== tenantId) {
      throw new DoctorIsolationViolationError();
    }

    if (safe.status !== DOCTOR_STATUS_DELETED) {
      throw new DoctorError('Doctor is not in deleted status.', 'DOCTOR_NOT_DELETED', 400);
    }

    const restored = await this.repository.update(id, {
      status: DOCTOR_STATUS_ACTIVE,
      deletedAt: null,
    });

    const safeRestored = this.mapToSafeDoctor(restored);

    await this.publisher.publish({
      type: EVENT_DOCTOR_RESTORED,
      payload: {
        tenantId,
        clinicId: safeRestored.clinicId,
        doctorId: id,
        actorId,
        requestId,
        occurredAt: new Date(),
      },
    });

    return safeRestored;
  }

  private validateTransition(from: DoctorStatus, to: DoctorStatus): boolean {
    if (from === DOCTOR_STATUS_DELETED) {
      return to === DOCTOR_STATUS_ACTIVE; // Path for restoration only
    }

    switch (from) {
      case DOCTOR_STATUS_ACTIVE:
        return (
          to === DOCTOR_STATUS_INACTIVE ||
          to === DOCTOR_STATUS_UNAVAILABLE ||
          to === DOCTOR_STATUS_ARCHIVED ||
          to === DOCTOR_STATUS_DELETED
        );
      case DOCTOR_STATUS_INACTIVE:
        return (
          to === DOCTOR_STATUS_ACTIVE ||
          to === DOCTOR_STATUS_UNAVAILABLE ||
          to === DOCTOR_STATUS_DELETED
        );
      case DOCTOR_STATUS_UNAVAILABLE:
        return (
          to === DOCTOR_STATUS_ACTIVE ||
          to === DOCTOR_STATUS_INACTIVE ||
          to === DOCTOR_STATUS_DELETED
        );
      case DOCTOR_STATUS_ARCHIVED:
        return to === DOCTOR_STATUS_ACTIVE || to === DOCTOR_STATUS_DELETED;
      default:
        return false;
    }
  }

  private mapToSafeDoctor(dbRecord: any): SafeDoctor {
    return {
      id: dbRecord.id,
      publicId: dbRecord.publicId,
      tenantId: dbRecord.tenantId,
      clinicId: dbRecord.clinicId,
      fullName: dbRecord.fullName,
      displayName: dbRecord.displayName,
      specialization: dbRecord.specialization,
      licenseNumber: dbRecord.licenseNumber,
      biography: dbRecord.biography,
      email: dbRecord.email,
      phone: dbRecord.phone,
      status: dbRecord.status as DoctorStatus,
      profilePhoto: dbRecord.profilePhoto,
      workingHours: (dbRecord.workingHours as unknown as WorkingHourInterval[]) ?? [],
      leaves: (dbRecord.leaves as unknown as DoctorLeaveInterval[]) ?? [],
      createdAt: dbRecord.createdAt,
      updatedAt: dbRecord.updatedAt,
      deletedAt: dbRecord.deletedAt,
    };
  }
}

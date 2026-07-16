/**
 * Clinic Service
 *
 * Implements business rules for clinic creation, status transitions, ownership transfers,
 * soft deletion/restoration, and event publication.
 */

import type {
  IClinicService,
  IClinicRepository,
  CreateClinicParams,
  UpdateClinicParams,
} from '../interfaces/clinic.interfaces';
import type { IClinicEventPublisher } from '../events/clinic-event.publisher';
import type { SafeClinic } from '../types/clinic.types';
import { ClinicStatus } from '../constants/clinic.constants';
import {
  ClinicNotFoundError,
  ClinicIsolationViolationError,
  ClinicSuspendedError,
  ClinicArchivedError,
  DuplicateClinicSlugError,
  InvalidClinicStatusTransitionError,
  OwnerTenantMismatchError,
  ClinicError,
} from '../errors/clinic.errors';
import {
  EVENT_CLINIC_CREATED,
  EVENT_CLINIC_UPDATED,
  EVENT_CLINIC_ACTIVATED,
  EVENT_CLINIC_SUSPENDED,
  EVENT_CLINIC_ARCHIVED,
  EVENT_CLINIC_DELETED,
  EVENT_CLINIC_RESTORED,
  EVENT_CLINIC_OWNERSHIP_TRANSFERRED,
} from '../events/clinic.events';
import { isValidTimezone } from '../validators/create-clinic.validator';
import {
  CLINIC_STATUS_PENDING_SETUP,
  CLINIC_STATUS_ACTIVE,
  CLINIC_STATUS_SUSPENDED,
  CLINIC_STATUS_ARCHIVED,
  CLINIC_STATUS_DELETED,
} from '../constants/clinic.constants';

export class ClinicService implements IClinicService {
  constructor(
    private readonly repository: IClinicRepository,
    private readonly publisher: IClinicEventPublisher,
  ) {}

  public async createClinic(params: CreateClinicParams): Promise<SafeClinic> {
    // 1. Timezone Check
    if (!isValidTimezone(params.timezone)) {
      throw new ClinicError(`Invalid timezone value: ${params.timezone}`, 'INVALID_TIMEZONE', 422);
    }

    // 2. Owner validation
    const ownerValid = await this.repository.userBelongsToTenant(params.ownerId, params.tenantId);
    if (!ownerValid) {
      throw new OwnerTenantMismatchError();
    }

    // 3. Slug check
    const slugExists = await this.repository.exists(params.slug);
    if (slugExists) {
      throw new DuplicateClinicSlugError(params.slug);
    }

    const created = await this.repository.create({
      tenantId: params.tenantId,
      ownerId: params.ownerId,
      name: params.name,
      legalName: params.legalName,
      slug: params.slug,
      timezone: params.timezone,
      country: params.country,
      status: CLINIC_STATUS_PENDING_SETUP,
      primaryEmail: params.primaryEmail,
      primaryPhone: params.primaryPhone,
      website: params.website,
      address: params.address,
      city: params.city,
      state: params.state,
      postalCode: params.postalCode,
      logoReference: params.logoReference,
      brandIdentifier: params.brandIdentifier,
      subscriptionId: params.subscriptionId,
      planId: params.planId,
      subscriptionStatus: params.subscriptionStatus,
    });

    const safe = this.mapToSafeClinic(created);

    await this.publisher.publish({
      type: EVENT_CLINIC_CREATED,
      payload: {
        tenantId: safe.tenantId,
        clinicId: safe.id,
        actorId: params.actorId,
        requestId: params.requestId,
        occurredAt: new Date(),
        ownerId: params.ownerId,
        name: params.name,
        slug: params.slug,
      },
    });

    return safe;
  }

  public async updateClinic(params: UpdateClinicParams): Promise<SafeClinic> {
    const existing = await this.repository.findById(params.id);
    if (!existing) {
      throw new ClinicNotFoundError(params.id);
    }

    const safeExisting = this.mapToSafeClinic(existing);
    if (safeExisting.tenantId !== params.tenantId) {
      throw new ClinicIsolationViolationError();
    }

    if (safeExisting.status === CLINIC_STATUS_DELETED) {
      throw new ClinicNotFoundError(params.id);
    }

    if (safeExisting.status === CLINIC_STATUS_ARCHIVED) {
      throw new ClinicArchivedError();
    }

    if (params.timezone && !isValidTimezone(params.timezone)) {
      throw new ClinicError(`Invalid timezone value: ${params.timezone}`, 'INVALID_TIMEZONE', 422);
    }

    const updateData: any = {};
    if (params.name !== undefined) updateData.name = params.name;
    if (params.legalName !== undefined) updateData.legalName = params.legalName;
    if (params.timezone !== undefined) updateData.timezone = params.timezone;
    if (params.country !== undefined) updateData.country = params.country;
    if (params.primaryEmail !== undefined) updateData.primaryEmail = params.primaryEmail;
    if (params.primaryPhone !== undefined) updateData.primaryPhone = params.primaryPhone;
    if (params.website !== undefined) updateData.website = params.website;
    if (params.address !== undefined) updateData.address = params.address;
    if (params.city !== undefined) updateData.city = params.city;
    if (params.state !== undefined) updateData.state = params.state;
    if (params.postalCode !== undefined) updateData.postalCode = params.postalCode;
    if (params.logoReference !== undefined) updateData.logoReference = params.logoReference;
    if (params.brandIdentifier !== undefined) updateData.brandIdentifier = params.brandIdentifier;
    if (params.subscriptionId !== undefined) updateData.subscriptionId = params.subscriptionId;
    if (params.planId !== undefined) updateData.planId = params.planId;
    if (params.subscriptionStatus !== undefined) updateData.subscriptionStatus = params.subscriptionStatus;

    const updated = await this.repository.update(params.id, updateData);
    const safeUpdated = this.mapToSafeClinic(updated);

    const changedFields = Object.keys(updateData);
    await this.publisher.publish({
      type: EVENT_CLINIC_UPDATED,
      payload: {
        tenantId: safeUpdated.tenantId,
        clinicId: safeUpdated.id,
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

  public async getClinicById(id: string, tenantId: string): Promise<SafeClinic> {
    const record = await this.repository.findById(id);
    if (!record) {
      throw new ClinicNotFoundError(id);
    }
    const safe = this.mapToSafeClinic(record);
    if (safe.tenantId !== tenantId) {
      throw new ClinicIsolationViolationError();
    }
    return safe;
  }

  public async getClinicBySlug(slug: string, tenantId: string): Promise<SafeClinic> {
    const record = await this.repository.findBySlug(slug);
    if (!record) {
      throw new ClinicNotFoundError();
    }
    const safe = this.mapToSafeClinic(record);
    if (safe.tenantId !== tenantId) {
      throw new ClinicIsolationViolationError();
    }
    return safe;
  }

  public async listClinics(params: {
    tenantId: string;
    status?: ClinicStatus;
    limit?: number;
    offset?: number;
  }): Promise<SafeClinic[]> {
    const records = await this.repository.findMany({
      tenantId: params.tenantId,
      status: params.status,
      limit: params.limit,
      offset: params.offset,
    });
    return records.map((r) => this.mapToSafeClinic(r));
  }

  public async transitionStatus(
    id: string,
    tenantId: string,
    targetStatus: ClinicStatus,
    actorId: string,
    requestId: string,
  ): Promise<SafeClinic> {
    const record = await this.repository.findById(id, targetStatus === CLINIC_STATUS_ACTIVE);
    if (!record) {
      throw new ClinicNotFoundError(id);
    }
    const safe = this.mapToSafeClinic(record);
    if (safe.tenantId !== tenantId) {
      throw new ClinicIsolationViolationError();
    }

    const currentStatus = safe.status;

    // Validate state machine transitions
    const valid = this.validateTransition(currentStatus, targetStatus);
    if (!valid) {
      throw new InvalidClinicStatusTransitionError(currentStatus, targetStatus);
    }

    const updated = await this.repository.update(id, { status: targetStatus });
    const safeUpdated = this.mapToSafeClinic(updated);

    // Audit logs trigger
    const occurredAt = new Date();
    const payload = {
      tenantId: safeUpdated.tenantId,
      clinicId: safeUpdated.id,
      actorId,
      requestId,
      occurredAt,
    };

    if (targetStatus === CLINIC_STATUS_ACTIVE) {
      await this.publisher.publish({ type: EVENT_CLINIC_ACTIVATED, payload });
    } else if (targetStatus === CLINIC_STATUS_SUSPENDED) {
      await this.publisher.publish({ type: EVENT_CLINIC_SUSPENDED, payload });
    } else if (targetStatus === CLINIC_STATUS_ARCHIVED) {
      await this.publisher.publish({ type: EVENT_CLINIC_ARCHIVED, payload });
    }

    return safeUpdated;
  }

  public async transferOwnership(
    id: string,
    tenantId: string,
    targetOwnerId: string,
    actorId: string,
    requestId: string,
  ): Promise<SafeClinic> {
    const record = await this.repository.findById(id);
    if (!record) {
      throw new ClinicNotFoundError(id);
    }
    const safe = this.mapToSafeClinic(record);
    if (safe.tenantId !== tenantId) {
      throw new ClinicIsolationViolationError();
    }

    if (safe.status === CLINIC_STATUS_ARCHIVED) {
      throw new ClinicArchivedError();
    }

    if (safe.status === CLINIC_STATUS_DELETED) {
      throw new ClinicNotFoundError(id);
    }

    const ownerValid = await this.repository.userBelongsToTenant(targetOwnerId, tenantId);
    if (!ownerValid) {
      throw new OwnerTenantMismatchError();
    }

    const previousOwnerId = safe.ownerId;
    const updated = await this.repository.update(id, { ownerId: targetOwnerId });
    const safeUpdated = this.mapToSafeClinic(updated);

    await this.publisher.publish({
      type: EVENT_CLINIC_OWNERSHIP_TRANSFERRED,
      payload: {
        tenantId: safeUpdated.tenantId,
        clinicId: safeUpdated.id,
        actorId,
        requestId,
        occurredAt: new Date(),
        previousOwnerId,
        newOwnerId: targetOwnerId,
      },
    });

    return safeUpdated;
  }

  public async softDeleteClinic(
    id: string,
    tenantId: string,
    actorId: string,
    requestId: string,
  ): Promise<void> {
    const record = await this.repository.findById(id);
    if (!record) {
      throw new ClinicNotFoundError(id);
    }
    const safe = this.mapToSafeClinic(record);
    if (safe.tenantId !== tenantId) {
      throw new ClinicIsolationViolationError();
    }

    await this.repository.update(id, {
      status: CLINIC_STATUS_DELETED,
      deletedAt: new Date(),
    });

    await this.publisher.publish({
      type: EVENT_CLINIC_DELETED,
      payload: {
        tenantId,
        clinicId: id,
        actorId,
        requestId,
        occurredAt: new Date(),
      },
    });
  }

  public async restoreClinic(
    id: string,
    tenantId: string,
    actorId: string,
    requestId: string,
  ): Promise<SafeClinic> {
    // include deleted: true so we can locate the deleted record to restore
    const record = await this.repository.findById(id, true);
    if (!record) {
      throw new ClinicNotFoundError(id);
    }
    const safe = this.mapToSafeClinic(record);
    if (safe.tenantId !== tenantId) {
      throw new ClinicIsolationViolationError();
    }

    if (safe.status !== CLINIC_STATUS_DELETED) {
      throw new ClinicError('Clinic is not in deleted status.', 'CLINIC_NOT_DELETED', 400);
    }

    const restored = await this.repository.update(id, {
      status: CLINIC_STATUS_ACTIVE,
      deletedAt: null,
    });

    const safeRestored = this.mapToSafeClinic(restored);

    await this.publisher.publish({
      type: EVENT_CLINIC_RESTORED,
      payload: {
        tenantId,
        clinicId: id,
        actorId,
        requestId,
        occurredAt: new Date(),
      },
    });

    return safeRestored;
  }

  private validateTransition(from: ClinicStatus, to: ClinicStatus): boolean {
    if (from === CLINIC_STATUS_DELETED) {
      return to === CLINIC_STATUS_ACTIVE; // Path for restoration only
    }

    switch (from) {
      case CLINIC_STATUS_PENDING_SETUP:
        return to === CLINIC_STATUS_ACTIVE || to === CLINIC_STATUS_DELETED;
      case CLINIC_STATUS_ACTIVE:
        return (
          to === CLINIC_STATUS_SUSPENDED ||
          to === CLINIC_STATUS_ARCHIVED ||
          to === CLINIC_STATUS_DELETED
        );
      case CLINIC_STATUS_SUSPENDED:
        return to === CLINIC_STATUS_ACTIVE || to === CLINIC_STATUS_DELETED;
      case CLINIC_STATUS_ARCHIVED:
        return to === CLINIC_STATUS_ACTIVE || to === CLINIC_STATUS_DELETED;
      default:
        return false;
    }
  }

  private mapToSafeClinic(dbRecord: any): SafeClinic {
    return {
      id: dbRecord.id,
      publicId: dbRecord.publicId,
      tenantId: dbRecord.tenantId,
      ownerId: dbRecord.ownerId,
      name: dbRecord.name,
      legalName: dbRecord.legalName,
      slug: dbRecord.slug,
      timezone: dbRecord.timezone,
      country: dbRecord.country,
      status: dbRecord.status as ClinicStatus,
      contact: {
        primaryEmail: dbRecord.primaryEmail,
        primaryPhone: dbRecord.primaryPhone,
        website: dbRecord.website,
        address: dbRecord.address,
        city: dbRecord.city,
        state: dbRecord.state,
        postalCode: dbRecord.postalCode,
      },
      branding: {
        logoReference: dbRecord.logoReference,
        brandIdentifier: dbRecord.brandIdentifier,
      },
      subscription: {
        subscriptionId: dbRecord.subscriptionId,
        planId: dbRecord.planId,
        subscriptionStatus: dbRecord.subscriptionStatus,
      },
      createdAt: dbRecord.createdAt,
      updatedAt: dbRecord.updatedAt,
      deletedAt: dbRecord.deletedAt,
    };
  }
}

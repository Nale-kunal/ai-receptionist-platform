/**
 * Appointment Service
 *
 * Implements the complete appointment lifecycle:
 *   - Booking with full availability validation
 *   - Conflict detection
 *   - Status state machine transitions
 *   - Rescheduling (preserves history via audit events)
 *   - Cancellation
 *   - Audit event publishing
 *
 * Business rules enforced here per 09_Appointment_Contract.md:
 *   1. Tenant isolation on every operation
 *   2. Doctor and patient must belong to the same clinic
 *   3. Clinic must be active (not suspended/deleted)
 *   4. Doctor must be active
 *   5. Patient must be active
 *   6. No overlapping appointments (double booking prohibited)
 *   7. endTime must be after startTime
 *   8. Status transitions validated via state machine
 *   9. Terminal statuses are immutable
 */

import type {
  IAppointmentService,
  IAppointmentRepository,
  CreateAppointmentParams,
  UpdateAppointmentParams,
  RescheduleAppointmentParams,
  CancelAppointmentParams,
  ListAppointmentsParams,
} from '../interfaces/appointment.interfaces';
import type { IAppointmentEventPublisher } from '../events/appointment-event.publisher';
import type { SafeAppointment } from '../types/appointment.types';
import type { AppointmentStatus, AppointmentSource } from '../constants/appointment.constants';
import {
  APPOINTMENT_STATUS_PENDING,
  APPOINTMENT_STATUS_CONFIRMED,
  APPOINTMENT_STATUS_COMPLETED,
  APPOINTMENT_STATUS_CANCELLED,
  APPOINTMENT_STATUS_NO_SHOW,
  APPOINTMENT_STATUS_RESCHEDULED,
  TERMINAL_APPOINTMENT_STATUSES,
} from '../constants/appointment.constants';
import {
  AppointmentNotFoundError,
  AppointmentConflictError,
  AppointmentIsolationViolationError,
  InvalidAppointmentStatusTransitionError,
  AppointmentAlreadyTerminalError,
  DoctorNotAvailableError,
  PatientNotActiveError,
  ClinicNotActiveError,
  AppointmentTimeRangeError,
  AppointmentOwnershipError,
} from '../errors/appointment.errors';
import {
  EVENT_APPOINTMENT_CREATED,
  EVENT_APPOINTMENT_UPDATED,
  EVENT_APPOINTMENT_CONFIRMED,
  EVENT_APPOINTMENT_CANCELLED,
  EVENT_APPOINTMENT_RESCHEDULED,
  EVENT_APPOINTMENT_COMPLETED,
  EVENT_APPOINTMENT_NO_SHOW,
} from '../events/appointment.events';

// ---------------------------------------------------------------------------
// State Machine
// ---------------------------------------------------------------------------

/**
 * Allowed transitions per contract state machine.
 *
 * pending     → confirmed | cancelled | no_show
 * confirmed   → completed | cancelled | no_show | rescheduled
 * rescheduled → confirmed | cancelled
 * cancelled   → (terminal)
 * completed   → (terminal)
 * no_show     → (terminal)
 */
const ALLOWED_TRANSITIONS: Record<AppointmentStatus, AppointmentStatus[]> = {
  [APPOINTMENT_STATUS_PENDING]: [
    APPOINTMENT_STATUS_CONFIRMED,
    APPOINTMENT_STATUS_CANCELLED,
    APPOINTMENT_STATUS_NO_SHOW,
  ],
  [APPOINTMENT_STATUS_CONFIRMED]: [
    APPOINTMENT_STATUS_COMPLETED,
    APPOINTMENT_STATUS_CANCELLED,
    APPOINTMENT_STATUS_NO_SHOW,
    APPOINTMENT_STATUS_RESCHEDULED,
  ],
  [APPOINTMENT_STATUS_RESCHEDULED]: [
    APPOINTMENT_STATUS_CONFIRMED,
    APPOINTMENT_STATUS_CANCELLED,
  ],
  [APPOINTMENT_STATUS_CANCELLED]: [],
  [APPOINTMENT_STATUS_COMPLETED]: [],
  [APPOINTMENT_STATUS_NO_SHOW]:   [],
};

// ---------------------------------------------------------------------------
// Service Implementation
// ---------------------------------------------------------------------------

export class AppointmentService implements IAppointmentService {
  constructor(
    private readonly repository: IAppointmentRepository,
    private readonly publisher: IAppointmentEventPublisher,
  ) {}

  // -------------------------------------------------------------------------
  // Create (Book)
  // -------------------------------------------------------------------------

  public async createAppointment(params: CreateAppointmentParams): Promise<SafeAppointment> {
    // 1. Validate time ordering
    if (params.endTime <= params.startTime) {
      throw new AppointmentTimeRangeError('endTime must be after startTime.');
    }

    // 2. Clinic is active
    const clinicActive = await this.repository.clinicIsActive(params.clinicId, params.tenantId);
    if (!clinicActive) {
      throw new ClinicNotActiveError();
    }

    // 3. Doctor belongs to clinic & tenant
    const doctorValid = await this.repository.doctorBelongsToClinic(
      params.doctorId,
      params.clinicId,
      params.tenantId,
    );
    if (!doctorValid) {
      throw new AppointmentOwnershipError();
    }

    // 4. Doctor is active
    const doctorStatus = await this.repository.getDoctorStatus(params.doctorId);
    if (doctorStatus !== 'active') {
      throw new DoctorNotAvailableError();
    }

    // 5. Patient belongs to clinic & tenant
    const patientValid = await this.repository.patientBelongsToClinic(
      params.patientId,
      params.clinicId,
      params.tenantId,
    );
    if (!patientValid) {
      throw new AppointmentOwnershipError();
    }

    // 6. Patient is active
    const patientStatus = await this.repository.getPatientStatus(params.patientId);
    if (patientStatus !== 'active') {
      throw new PatientNotActiveError();
    }

    // 7. Conflict detection
    const conflicts = await this.repository.findConflicts({
      doctorId:  params.doctorId,
      clinicId:  params.clinicId,
      startTime: params.startTime,
      endTime:   params.endTime,
    });
    if (conflicts.length > 0) {
      throw new AppointmentConflictError();
    }

    // 8. Persist
    const created = await this.repository.create({
      tenantId:  params.tenantId,
      clinicId:  params.clinicId,
      doctorId:  params.doctorId,
      patientId: params.patientId,
      startTime: params.startTime,
      endTime:   params.endTime,
      timezone:  params.timezone,
      status:    APPOINTMENT_STATUS_PENDING,
      source:    params.source,
      notes:     params.notes,
    });

    const safe = this.toSafe(created);

    // 9. Publish audit event
    await this.publisher.publish({
      type: EVENT_APPOINTMENT_CREATED,
      payload: {
        tenantId:      safe.tenantId,
        clinicId:      safe.clinicId,
        doctorId:      safe.doctorId,
        patientId:     safe.patientId,
        appointmentId: safe.id,
        actorId:       params.actorId,
        requestId:     params.requestId,
        occurredAt:    new Date(),
        startTime:     safe.startTime,
        endTime:       safe.endTime,
        timezone:      safe.timezone,
        source:        safe.source,
      },
    });

    return safe;
  }

  // -------------------------------------------------------------------------
  // Update (notes only)
  // -------------------------------------------------------------------------

  public async updateAppointment(params: UpdateAppointmentParams): Promise<SafeAppointment> {
    const existing = await this.requireAppointment(params.id, params.tenantId);

    this.assertNotTerminal(existing.status);

    const previous = { ...existing };
    const updateData: Record<string, unknown> = {};

    if (params.notes !== undefined) updateData.notes = params.notes;

    const updated = await this.repository.update(params.id, updateData);
    const safe = this.toSafe(updated);

    await this.publisher.publish({
      type: EVENT_APPOINTMENT_UPDATED,
      payload: {
        tenantId:      safe.tenantId,
        clinicId:      safe.clinicId,
        doctorId:      safe.doctorId,
        patientId:     safe.patientId,
        appointmentId: safe.id,
        actorId:       params.actorId,
        requestId:     params.requestId,
        occurredAt:    new Date(),
        changedFields: Object.keys(updateData),
        previous,
        current: safe,
      },
    });

    return safe;
  }

  // -------------------------------------------------------------------------
  // Reschedule
  // -------------------------------------------------------------------------

  public async rescheduleAppointment(params: RescheduleAppointmentParams): Promise<SafeAppointment> {
    if (params.endTime <= params.startTime) {
      throw new AppointmentTimeRangeError('endTime must be after startTime.');
    }

    const existing = await this.requireAppointment(params.id, params.tenantId);

    // Must be in a state that allows rescheduling
    this.assertTransitionAllowed(existing.status, APPOINTMENT_STATUS_RESCHEDULED);

    // Conflict detection (excluding self)
    const conflicts = await this.repository.findConflicts({
      doctorId:  existing.doctorId,
      clinicId:  existing.clinicId,
      startTime: params.startTime,
      endTime:   params.endTime,
      excludeId: params.id,
    });
    if (conflicts.length > 0) {
      throw new AppointmentConflictError();
    }

    const previousStartTime = existing.startTime;
    const previousEndTime   = existing.endTime;

    const updated = await this.repository.update(params.id, {
      startTime: params.startTime,
      endTime:   params.endTime,
      status:    APPOINTMENT_STATUS_RESCHEDULED,
      ...(params.timezone !== undefined ? { timezone: params.timezone } : {}),
      ...(params.notes    !== undefined ? { notes:    params.notes    } : {}),
    });
    const safe = this.toSafe(updated);

    await this.publisher.publish({
      type: EVENT_APPOINTMENT_RESCHEDULED,
      payload: {
        tenantId:         safe.tenantId,
        clinicId:         safe.clinicId,
        doctorId:         safe.doctorId,
        patientId:        safe.patientId,
        appointmentId:    safe.id,
        actorId:          params.actorId,
        requestId:        params.requestId,
        occurredAt:       new Date(),
        previousStartTime,
        previousEndTime,
        newStartTime:     params.startTime,
        newEndTime:       params.endTime,
      },
    });

    return safe;
  }

  // -------------------------------------------------------------------------
  // Cancel
  // -------------------------------------------------------------------------

  public async cancelAppointment(params: CancelAppointmentParams): Promise<SafeAppointment> {
    const existing = await this.requireAppointment(params.id, params.tenantId);

    this.assertTransitionAllowed(existing.status, APPOINTMENT_STATUS_CANCELLED);

    const now = new Date();
    const updated = await this.repository.update(params.id, {
      status:             APPOINTMENT_STATUS_CANCELLED,
      cancellationReason: params.cancellationReason ?? null,
      cancelledAt:        now,
    });
    const safe = this.toSafe(updated);

    await this.publisher.publish({
      type: EVENT_APPOINTMENT_CANCELLED,
      payload: {
        tenantId:           safe.tenantId,
        clinicId:           safe.clinicId,
        doctorId:           safe.doctorId,
        patientId:          safe.patientId,
        appointmentId:      safe.id,
        actorId:            params.actorId,
        requestId:          params.requestId,
        occurredAt:         now,
        cancellationReason: params.cancellationReason ?? null,
      },
    });

    return safe;
  }

  // -------------------------------------------------------------------------
  // Confirm
  // -------------------------------------------------------------------------

  public async confirmAppointment(
    id: string,
    tenantId: string,
    actorId: string,
    requestId: string,
  ): Promise<SafeAppointment> {
    const existing = await this.requireAppointment(id, tenantId);
    this.assertTransitionAllowed(existing.status, APPOINTMENT_STATUS_CONFIRMED);

    const updated = await this.repository.update(id, { status: APPOINTMENT_STATUS_CONFIRMED });
    const safe = this.toSafe(updated);

    await this.publisher.publish({
      type: EVENT_APPOINTMENT_CONFIRMED,
      payload: {
        tenantId:      safe.tenantId,
        clinicId:      safe.clinicId,
        doctorId:      safe.doctorId,
        patientId:     safe.patientId,
        appointmentId: safe.id,
        actorId,
        requestId,
        occurredAt:    new Date(),
      },
    });

    return safe;
  }

  // -------------------------------------------------------------------------
  // Complete
  // -------------------------------------------------------------------------

  public async completeAppointment(
    id: string,
    tenantId: string,
    actorId: string,
    requestId: string,
  ): Promise<SafeAppointment> {
    const existing = await this.requireAppointment(id, tenantId);
    this.assertTransitionAllowed(existing.status, APPOINTMENT_STATUS_COMPLETED);

    const updated = await this.repository.update(id, { status: APPOINTMENT_STATUS_COMPLETED });
    const safe = this.toSafe(updated);

    await this.publisher.publish({
      type: EVENT_APPOINTMENT_COMPLETED,
      payload: {
        tenantId:      safe.tenantId,
        clinicId:      safe.clinicId,
        doctorId:      safe.doctorId,
        patientId:     safe.patientId,
        appointmentId: safe.id,
        actorId,
        requestId,
        occurredAt:    new Date(),
      },
    });

    return safe;
  }

  // -------------------------------------------------------------------------
  // No Show
  // -------------------------------------------------------------------------

  public async markNoShow(
    id: string,
    tenantId: string,
    actorId: string,
    requestId: string,
  ): Promise<SafeAppointment> {
    const existing = await this.requireAppointment(id, tenantId);
    this.assertTransitionAllowed(existing.status, APPOINTMENT_STATUS_NO_SHOW);

    const updated = await this.repository.update(id, { status: APPOINTMENT_STATUS_NO_SHOW });
    const safe = this.toSafe(updated);

    await this.publisher.publish({
      type: EVENT_APPOINTMENT_NO_SHOW,
      payload: {
        tenantId:      safe.tenantId,
        clinicId:      safe.clinicId,
        doctorId:      safe.doctorId,
        patientId:     safe.patientId,
        appointmentId: safe.id,
        actorId,
        requestId,
        occurredAt:    new Date(),
      },
    });

    return safe;
  }

  // -------------------------------------------------------------------------
  // Read
  // -------------------------------------------------------------------------

  public async getAppointmentById(id: string, tenantId: string): Promise<SafeAppointment> {
    const record = await this.repository.findById(id);
    if (!record) {
      throw new AppointmentNotFoundError(id);
    }
    const safe = this.toSafe(record);
    if (safe.tenantId !== tenantId) {
      throw new AppointmentIsolationViolationError();
    }
    return safe;
  }

  public async getAppointmentByPublicId(publicId: string, tenantId: string): Promise<SafeAppointment> {
    const record = await this.repository.findByPublicId(publicId);
    if (!record) {
      throw new AppointmentNotFoundError();
    }
    const safe = this.toSafe(record);
    if (safe.tenantId !== tenantId) {
      throw new AppointmentIsolationViolationError();
    }
    return safe;
  }

  public async listAppointments(params: ListAppointmentsParams): Promise<SafeAppointment[]> {
    const records = await this.repository.findMany({
      tenantId:  params.tenantId,
      clinicId:  params.clinicId,
      doctorId:  params.doctorId,
      patientId: params.patientId,
      status:    params.status,
      source:    params.source,
      startFrom: params.startFrom,
      startTo:   params.startTo,
      publicId:  params.publicId,
      limit:     params.limit,
      offset:    params.offset,
    });
    return records.map((r) => this.toSafe(r));
  }

  // -------------------------------------------------------------------------
  // Private Helpers
  // -------------------------------------------------------------------------

  private async requireAppointment(id: string, tenantId: string): Promise<SafeAppointment> {
    const record = await this.repository.findById(id);
    if (!record) {
      throw new AppointmentNotFoundError(id);
    }
    const safe = this.toSafe(record);
    if (safe.tenantId !== tenantId) {
      throw new AppointmentIsolationViolationError();
    }
    return safe;
  }

  private assertNotTerminal(status: AppointmentStatus): void {
    if ((TERMINAL_APPOINTMENT_STATUSES as readonly string[]).includes(status)) {
      throw new AppointmentAlreadyTerminalError(status);
    }
  }

  private assertTransitionAllowed(from: AppointmentStatus, to: AppointmentStatus): void {
    if ((TERMINAL_APPOINTMENT_STATUSES as readonly string[]).includes(from)) {
      throw new AppointmentAlreadyTerminalError(from);
    }
    const allowed = ALLOWED_TRANSITIONS[from] ?? [];
    if (!allowed.includes(to)) {
      throw new InvalidAppointmentStatusTransitionError(from, to);
    }
  }

  private toSafe(record: any): SafeAppointment {
    return {
      id:                 record.id,
      publicId:           record.publicId,
      tenantId:           record.tenantId,
      clinicId:           record.clinicId,
      doctorId:           record.doctorId,
      patientId:          record.patientId,
      startTime:          record.startTime,
      endTime:            record.endTime,
      timezone:           record.timezone,
      status:             record.status as AppointmentStatus,
      source:             record.source as AppointmentSource,
      notes:              record.notes ?? null,
      cancellationReason: record.cancellationReason ?? null,
      cancelledAt:        record.cancelledAt ?? null,
      createdAt:          record.createdAt,
      updatedAt:          record.updatedAt,
      deletedAt:          record.deletedAt ?? null,
    };
  }
}

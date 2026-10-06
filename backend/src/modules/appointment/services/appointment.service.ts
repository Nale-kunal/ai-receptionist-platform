/**
 * Appointment Service
 *
 * Implements the complete appointment lifecycle:
 *   - Booking with full canonical availability & break validation
 *   - Conflict detection & atomic double-booking protection
 *   - Status state machine transitions
 *   - Rescheduling (preserves history via audit events)
 *   - Cancellation
 *   - Audit event publishing
 *
 * Business rules enforced here:
 *   1. Tenant isolation on every operation
 *   2. Doctor and patient must belong to the same clinic
 *   3. Clinic must be active (not suspended/deleted)
 *   4. Doctor must be active & available (not on leave, not closed)
 *   5. Entire appointment duration must fall within open working hours
 *   6. Appointment must NOT overlap lunch/break intervals
 *   7. Patient must be active
 *   8. No overlapping appointments (double booking prohibited)
 *   9. endTime must be after startTime
 *  10. Status transitions validated via state machine
 *  11. Terminal statuses are immutable
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
  APPOINTMENT_STATUS_SCHEDULED,
  APPOINTMENT_STATUS_PENDING,
  APPOINTMENT_STATUS_CONFIRMED,
  APPOINTMENT_STATUS_CHECKED_IN,
  APPOINTMENT_STATUS_IN_PROGRESS,
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
  DoctorBreakConflictError,
  DoctorScheduleClosedError,
  AppointmentOutsideWorkingHoursError,
  DoctorOnLeaveError,
  PatientNotActiveError,
  ClinicNotActiveError,
  AppointmentTimeRangeError,
  AppointmentOwnershipError,
} from '../errors/appointment.errors';
import {
  EVENT_APPOINTMENT_CREATED,
  EVENT_APPOINTMENT_UPDATED,
  EVENT_APPOINTMENT_CONFIRMED,
  EVENT_APPOINTMENT_CHECKED_IN,
  EVENT_APPOINTMENT_IN_PROGRESS,
  EVENT_APPOINTMENT_CANCELLED,
  EVENT_APPOINTMENT_RESCHEDULED,
  EVENT_APPOINTMENT_COMPLETED,
  EVENT_APPOINTMENT_NO_SHOW,
} from '../events/appointment.events';
import {
  validateDoctorAvailability,
  DoctorAvailabilityResult,
} from '../../../shared/scheduling/doctorAvailabilityEngine';

// ---------------------------------------------------------------------------
// Error Dispatcher Helper
// ---------------------------------------------------------------------------

function throwAvailabilityError(res: DoctorAvailabilityResult): never {
  switch (res.errorCode) {
    case 'DOCTOR_BREAK_CONFLICT':
      throw new DoctorBreakConflictError(res.reason, res.details);
    case 'DOCTOR_SCHEDULE_CLOSED':
      throw new DoctorScheduleClosedError(res.reason, res.details);
    case 'APPOINTMENT_OUTSIDE_WORKING_HOURS':
      throw new AppointmentOutsideWorkingHoursError(res.reason, res.details);
    case 'DOCTOR_ON_LEAVE':
      throw new DoctorOnLeaveError(res.reason, res.details);
    case 'APPOINTMENT_CONFLICT':
      throw new AppointmentConflictError(res.reason, res.details);
    case 'INVALID_TIME_RANGE':
      throw new AppointmentTimeRangeError(res.reason || 'Invalid appointment time range.');
    case 'CLINIC_CLOSED':
      throw new ClinicNotActiveError();
    case 'DOCTOR_NOT_AVAILABLE':
    default:
      throw new DoctorNotAvailableError(res.reason, res.details);
  }
}

// ---------------------------------------------------------------------------
// State Machine
// ---------------------------------------------------------------------------

const ALLOWED_TRANSITIONS: Record<AppointmentStatus, AppointmentStatus[]> = {
  [APPOINTMENT_STATUS_SCHEDULED]: [
    APPOINTMENT_STATUS_CONFIRMED,
    APPOINTMENT_STATUS_CHECKED_IN,
    APPOINTMENT_STATUS_CANCELLED,
    APPOINTMENT_STATUS_NO_SHOW,
    APPOINTMENT_STATUS_RESCHEDULED,
  ],
  [APPOINTMENT_STATUS_PENDING]: [
    APPOINTMENT_STATUS_SCHEDULED,
    APPOINTMENT_STATUS_CONFIRMED,
    APPOINTMENT_STATUS_CHECKED_IN,
    APPOINTMENT_STATUS_CANCELLED,
    APPOINTMENT_STATUS_NO_SHOW,
    APPOINTMENT_STATUS_RESCHEDULED,
  ],
  [APPOINTMENT_STATUS_CONFIRMED]: [
    APPOINTMENT_STATUS_CHECKED_IN,
    APPOINTMENT_STATUS_IN_PROGRESS,
    APPOINTMENT_STATUS_COMPLETED,
    APPOINTMENT_STATUS_CANCELLED,
    APPOINTMENT_STATUS_NO_SHOW,
    APPOINTMENT_STATUS_RESCHEDULED,
  ],
  [APPOINTMENT_STATUS_CHECKED_IN]: [
    APPOINTMENT_STATUS_IN_PROGRESS,
    APPOINTMENT_STATUS_COMPLETED,
    APPOINTMENT_STATUS_CANCELLED,
    APPOINTMENT_STATUS_NO_SHOW,
    APPOINTMENT_STATUS_RESCHEDULED,
  ],
  [APPOINTMENT_STATUS_IN_PROGRESS]: [
    APPOINTMENT_STATUS_COMPLETED,
    APPOINTMENT_STATUS_CANCELLED,
  ],
  [APPOINTMENT_STATUS_RESCHEDULED]: [
    APPOINTMENT_STATUS_SCHEDULED,
    APPOINTMENT_STATUS_CONFIRMED,
    APPOINTMENT_STATUS_CHECKED_IN,
    APPOINTMENT_STATUS_IN_PROGRESS,
    APPOINTMENT_STATUS_COMPLETED,
    APPOINTMENT_STATUS_CANCELLED,
    APPOINTMENT_STATUS_NO_SHOW,
    APPOINTMENT_STATUS_RESCHEDULED,
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
    // 0. Auto-resolve clinicId if omitted
    let clinicId = params.clinicId;
    if (!clinicId) {
      const docClinicId = await this.repository.getDoctorClinicId(params.doctorId);
      if (docClinicId) {
        clinicId = docClinicId;
      } else {
        const mainClinic: any = await this.repository.findMainClinicForTenant(params.tenantId);
        if (!mainClinic) {
          throw new ClinicNotActiveError();
        }
        clinicId = mainClinic.id;
      }
    }

    // 1. Validate time ordering
    if (params.endTime <= params.startTime) {
      throw new AppointmentTimeRangeError('endTime must be after startTime.');
    }

    // 2. Clinic is active
    const clinicActive = await this.repository.clinicIsActive(clinicId!, params.tenantId);
    if (!clinicActive) {
      throw new ClinicNotActiveError();
    }

    // 3. Doctor belongs to clinic & tenant
    const doctorValid = await this.repository.doctorBelongsToClinic(
      params.doctorId,
      clinicId!,
      params.tenantId,
    );
    if (!doctorValid) {
      throw new AppointmentOwnershipError();
    }

    // 4. Fetch Doctor Details (status, workingHours, leaves, clinic timezone)
    const doctorDetails = typeof this.repository.getDoctorDetails === 'function'
      ? await this.repository.getDoctorDetails(params.doctorId)
      : {
          id: params.doctorId,
          status: await this.repository.getDoctorStatus(params.doctorId) || 'active',
          workingHours: [],
          leaves: [],
        };

    if (!doctorDetails || doctorDetails.status !== 'active') {
      throw new DoctorNotAvailableError('Practitioner is inactive or unavailable.');
    }

    const resolvedTenantId = params.tenantId || doctorDetails.tenantId;
    if (!resolvedTenantId) {
      throw new AppointmentOwnershipError();
    }

    // 5. Authoritative Timezone Resolution
    const authoritativeTimezone =
      params.timezone ||
      doctorDetails.clinic?.timezone ||
      'UTC';

    // 6. Authoritative Canonical Availability Check (Hours, Breaks, Leaves, Closed Days)
    const availCheck = validateDoctorAvailability({
      doctor: doctorDetails,
      startTime: params.startTime,
      endTime: params.endTime,
      timezone: authoritativeTimezone,
    });
    if (!availCheck.valid) {
      throwAvailabilityError(availCheck);
    }

    // 7. Patient belongs to clinic & tenant
    const patientValid = await this.repository.patientBelongsToClinic(
      params.patientId,
      clinicId!,
      resolvedTenantId,
    );
    if (!patientValid) {
      throw new AppointmentOwnershipError();
    }

    // 8. Patient is active
    const patientStatus = await this.repository.getPatientStatus(params.patientId);
    if (patientStatus !== 'active') {
      throw new PatientNotActiveError();
    }

    // 9. Atomic Conflict-Safe Persist
    const rawType = (params.appointmentType || 'routine_checkup').toLowerCase().trim();
    let finalNotes = params.notes ?? null;
    if (rawType === 'other' && params.otherReason?.trim()) {
      const customReasonText = `Reason: ${params.otherReason.trim()}`;
      finalNotes = finalNotes ? `${customReasonText}\n\nNotes: ${finalNotes}` : customReasonText;
    }

    const created = typeof this.repository.createWithAtomicConflictCheck === 'function'
      ? await this.repository.createWithAtomicConflictCheck({
          tenantId:  resolvedTenantId,
          clinicId:  clinicId!,
          doctorId:  params.doctorId,
          patientId: params.patientId,
          startTime: params.startTime,
          endTime:   params.endTime,
          timezone:  authoritativeTimezone,
          status:    APPOINTMENT_STATUS_SCHEDULED,
          source:    params.source,
          appointmentType: rawType,
          durationMinutes: params.durationMinutes ?? 30,
          notes:     finalNotes,
        })
      : await (async () => {
          const conflicts = await this.repository.findConflicts({
            tenantId:  params.tenantId,
            doctorId:  params.doctorId,
            clinicId:  clinicId!,
            startTime: params.startTime,
            endTime:   params.endTime,
          });
          if (conflicts.length > 0) {
            throw new AppointmentConflictError();
          }
          return this.repository.create({
            tenantId:  params.tenantId,
            clinicId:  clinicId!,
            doctorId:  params.doctorId,
            patientId: params.patientId,
            startTime: params.startTime,
            endTime:   params.endTime,
            timezone:  authoritativeTimezone,
            status:    APPOINTMENT_STATUS_SCHEDULED,
            source:    params.source,
            appointmentType: rawType,
            durationMinutes: params.durationMinutes ?? 30,
            notes:     finalNotes,
          });
        })();

    const safe = this.toSafe(created);

    // 10. Publish audit event
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

    // Fetch Doctor Details & Authoritative Timezone
    const doctorDetails = typeof this.repository.getDoctorDetails === 'function'
      ? await this.repository.getDoctorDetails(existing.doctorId)
      : {
          id: existing.doctorId,
          status: await this.repository.getDoctorStatus(existing.doctorId) || 'active',
          workingHours: [],
          leaves: [],
        };

    if (!doctorDetails || doctorDetails.status !== 'active') {
      throw new DoctorNotAvailableError('Practitioner is inactive or unavailable.');
    }

    const authoritativeTimezone =
      params.timezone ||
      existing.timezone ||
      doctorDetails.clinic?.timezone ||
      'UTC';

    // Canonical Availability Check on Reschedule (Excluding Self)
    const availCheck = validateDoctorAvailability({
      doctor: doctorDetails,
      startTime: params.startTime,
      endTime: params.endTime,
      timezone: authoritativeTimezone,
      excludeAppointmentId: params.id,
    });
    if (!availCheck.valid) {
      throwAvailabilityError(availCheck);
    }

    const previousStartTime = existing.startTime;
    const previousEndTime   = existing.endTime;

    const durationMinutes =
      params.durationMinutes ??
      Math.max(5, Math.round((params.endTime.getTime() - params.startTime.getTime()) / 60000));

    // Atomic Reschedule with Row Lock
    const updated = typeof this.repository.rescheduleWithAtomicConflictCheck === 'function'
      ? await this.repository.rescheduleWithAtomicConflictCheck(params.id, {
          tenantId:        existing.tenantId,
          doctorId:        existing.doctorId,
          clinicId:        existing.clinicId,
          startTime:       params.startTime,
          endTime:         params.endTime,
          durationMinutes,
          timezone:        authoritativeTimezone,
          notes:           params.notes,
        })
      : await (async () => {
          const conflicts = await this.repository.findConflicts({
            tenantId:  existing.tenantId,
            doctorId:  existing.doctorId,
            clinicId:  existing.clinicId,
            startTime: params.startTime,
            endTime:   params.endTime,
            excludeId: params.id,
          });
          if (conflicts.length > 0) {
            throw new AppointmentConflictError();
          }
          return this.repository.update(params.id, {
            startTime:       params.startTime,
            endTime:         params.endTime,
            durationMinutes,
            status:          APPOINTMENT_STATUS_RESCHEDULED,
            ...(params.timezone !== undefined ? { timezone: authoritativeTimezone } : {}),
            ...(params.notes    !== undefined ? { notes:    params.notes    } : {}),
          });
        })();

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
  // Check-In
  // -------------------------------------------------------------------------

  public async checkInAppointment(
    id: string,
    tenantId: string,
    actorId: string,
    requestId: string,
  ): Promise<SafeAppointment> {
    const existing = await this.requireAppointment(id, tenantId);
    this.assertTransitionAllowed(existing.status, APPOINTMENT_STATUS_CHECKED_IN);

    const updated = await this.repository.update(id, { status: APPOINTMENT_STATUS_CHECKED_IN });
    const safe = this.toSafe(updated);

    await this.publisher.publish({
      type: EVENT_APPOINTMENT_CHECKED_IN,
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
  // Start Consultation (In Progress)
  // -------------------------------------------------------------------------

  public async startAppointment(
    id: string,
    tenantId: string,
    actorId: string,
    requestId: string,
  ): Promise<SafeAppointment> {
    const existing = await this.requireAppointment(id, tenantId);
    this.assertTransitionAllowed(existing.status, APPOINTMENT_STATUS_IN_PROGRESS);

    const updated = await this.repository.update(id, { status: APPOINTMENT_STATUS_IN_PROGRESS });
    const safe = this.toSafe(updated);

    await this.publisher.publish({
      type: EVENT_APPOINTMENT_IN_PROGRESS,
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

  public async listAppointments(params: ListAppointmentsParams): Promise<any> {
    const page = params.page ?? 1;
    const limit = params.limit ?? 20;
    const offset = params.offset ?? (page - 1) * limit;

    const [records, total] = await Promise.all([
      this.repository.findMany({
        tenantId:  params.tenantId,
        clinicId:  params.clinicId,
        doctorId:  params.doctorId,
        patientId: params.patientId,
        status:    params.status,
        source:    params.source,
        search:    params.search,
        startFrom: params.startFrom,
        startTo:   params.startTo,
        publicId:  params.publicId,
        limit,
        offset,
      }),
      this.repository.countMany({
        tenantId:  params.tenantId,
        clinicId:  params.clinicId,
        doctorId:  params.doctorId,
        patientId: params.patientId,
        status:    params.status,
        source:    params.source,
        search:    params.search,
        startFrom: params.startFrom,
        startTo:   params.startTo,
        publicId:  params.publicId,
      }),
    ]);

    const mapped = records.map((r) => this.toSafe(r));
    const totalPages = Math.ceil(total / limit) || 1;

    return {
      appointments: mapped,
      total,
      page,
      limit,
      totalPages,
    };
  }

  public async getStatusCounters(tenantId: string, clinicId?: string): Promise<Record<string, number>> {
    return this.repository.getStatusCounters(tenantId, clinicId);
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
      durationMinutes:    record.durationMinutes ?? 30,
      appointmentType:    record.appointmentType ?? 'checkup',
      timezone:           record.timezone,
      status:             record.status as AppointmentStatus,
      source:             record.source as AppointmentSource,
      notes:              record.notes ?? null,
      cancellationReason: record.cancellationReason ?? null,
      cancelledAt:        record.cancelledAt ?? null,
      createdAt:          record.createdAt,
      updatedAt:          record.updatedAt,
      deletedAt:          record.deletedAt ?? null,
      patientName:        record.patient?.fullName,
      patientPhone:       record.patient?.phone,
      doctorName:         record.doctor?.fullName,
    };
  }
}

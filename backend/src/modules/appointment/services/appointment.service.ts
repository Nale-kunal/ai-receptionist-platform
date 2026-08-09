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
// Doctor Working Hours Validator Helper
// ---------------------------------------------------------------------------

const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

function parseHHmm(timeStr: string): number {
  const [h, m] = (timeStr || '').split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

function checkDoctorWorkingHours(
  workingHours: any,
  startTime: Date,
  endTime: Date
): { valid: boolean; reason?: string } {
  if (!Array.isArray(workingHours) || workingHours.length === 0) {
    return { valid: true };
  }

  const dayOfWeekNum = startTime.getDay();
  const dayName = DAY_NAMES[dayOfWeekNum];

  const matchedDay = workingHours.find((wh: any) => {
    if (typeof wh.day === 'string' && wh.day.toLowerCase() === dayName) return true;
    if (typeof wh.dayOfWeek === 'number' && wh.dayOfWeek === dayOfWeekNum) return true;
    if (
      typeof wh.dayOfWeek === 'string' &&
      (wh.dayOfWeek.toLowerCase() === dayName || parseInt(wh.dayOfWeek, 10) === dayOfWeekNum)
    )
      return true;
    return false;
  });

  if (!matchedDay) {
    return { valid: false, reason: `Practitioner does not work on ${dayName}s.` };
  }

  const isOff = matchedDay.isClosed === true || matchedDay.isOff === true || matchedDay.closed === true;
  if (isOff) {
    return { valid: false, reason: `Practitioner is off / closed on ${dayName}s.` };
  }

  const openTime = matchedDay.openTime || matchedDay.startTime || matchedDay.start || '09:00';
  const closeTime = matchedDay.closeTime || matchedDay.endTime || matchedDay.end || '17:00';

  const startMins = startTime.getHours() * 60 + startTime.getMinutes();
  const endMins = endTime.getHours() * 60 + endTime.getMinutes();

  const openMins = parseHHmm(openTime);
  const closeMins = parseHHmm(closeTime);

  if (startMins < openMins || endMins > closeMins) {
    return {
      valid: false,
      reason: `Selected appointment slot is outside practitioner working hours (${openTime} to ${closeTime}).`,
    };
  }

  // Validate lunch break (default 12:00 to 13:00)
  const breakStartStr = matchedDay.breakStart || '12:00';
  const breakEndStr = matchedDay.breakEnd || '13:00';
  const breakStartMins = parseHHmm(breakStartStr);
  const breakEndMins = parseHHmm(breakEndStr);

  if (breakEndMins > breakStartMins) {
    if (startMins < breakEndMins && endMins > breakStartMins) {
      return {
        valid: false,
        reason: `Selected appointment slot overlaps practitioner lunch break (${breakStartStr} to ${breakEndStr}).`,
      };
    }
  }

  return { valid: true };
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
    APPOINTMENT_STATUS_CANCELLED,
    APPOINTMENT_STATUS_NO_SHOW,
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

    // 4. Doctor is active & working hours check
    const doctorDetails = typeof this.repository.getDoctorDetails === 'function'
      ? await this.repository.getDoctorDetails(params.doctorId)
      : { id: params.doctorId, status: await this.repository.getDoctorStatus(params.doctorId), workingHours: [] };
    if (!doctorDetails || doctorDetails.status !== 'active') {
      throw new DoctorNotAvailableError('Practitioner is inactive or unavailable.');
    }
    const workHoursCheck = checkDoctorWorkingHours(doctorDetails.workingHours, params.startTime, params.endTime);
    if (!workHoursCheck.valid) {
      throw new DoctorNotAvailableError(workHoursCheck.reason);
    }

    // 5. Patient belongs to clinic & tenant
    const patientValid = await this.repository.patientBelongsToClinic(
      params.patientId,
      clinicId!,
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
      clinicId:  clinicId!,
      startTime: params.startTime,
      endTime:   params.endTime,
    });
    if (conflicts.length > 0) {
      throw new AppointmentConflictError();
    }

    // 8. Persist
    const created = await this.repository.create({
      tenantId:  params.tenantId,
      clinicId:  clinicId!,
      doctorId:  params.doctorId,
      patientId: params.patientId,
      startTime: params.startTime,
      endTime:   params.endTime,
      timezone:  params.timezone,
      status:    APPOINTMENT_STATUS_SCHEDULED,
      source:    params.source,
      appointmentType: params.appointmentType ?? 'checkup',
      durationMinutes: params.durationMinutes ?? 30,
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

    // Doctor details & working hours check on reschedule
    const doctorDetails = typeof this.repository.getDoctorDetails === 'function'
      ? await this.repository.getDoctorDetails(existing.doctorId)
      : { id: existing.doctorId, status: await this.repository.getDoctorStatus(existing.doctorId), workingHours: [] };
    if (!doctorDetails || doctorDetails.status !== 'active') {
      throw new DoctorNotAvailableError('Practitioner is inactive or unavailable.');
    }
    const workHoursCheck = checkDoctorWorkingHours(doctorDetails.workingHours, params.startTime, params.endTime);
    if (!workHoursCheck.valid) {
      throw new DoctorNotAvailableError(workHoursCheck.reason);
    }

    // Conflict detection (excluding self)
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

    const previousStartTime = existing.startTime;
    const previousEndTime   = existing.endTime;

    const durationMinutes =
      params.durationMinutes ??
      Math.max(5, Math.round((params.endTime.getTime() - params.startTime.getTime()) / 60000));

    const updated = await this.repository.update(params.id, {
      startTime:       params.startTime,
      endTime:         params.endTime,
      durationMinutes,
      status:          APPOINTMENT_STATUS_RESCHEDULED,
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

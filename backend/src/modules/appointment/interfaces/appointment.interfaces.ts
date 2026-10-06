/**
 * Appointment Module Interfaces & Contracts
 */

import type { AppointmentStatus, AppointmentSource } from '../constants/appointment.constants';
import type { SafeAppointment } from '../types/appointment.types';

// ---------------------------------------------------------------------------
// Service Param Interfaces
// ---------------------------------------------------------------------------

export interface CreateAppointmentParams {
  tenantId: string;
  clinicId?: string;
  doctorId: string;
  patientId: string;
  startTime: Date;
  endTime: Date;
  timezone: string;
  source: AppointmentSource;
  appointmentType?: string;
  otherReason?: string;
  durationMinutes?: number;
  notes?: string | null;

  actorId: string;
  requestId: string;
}

export interface UpdateAppointmentParams {
  id: string;
  tenantId: string;
  notes?: string | null;

  actorId: string;
  requestId: string;
}

export interface RescheduleAppointmentParams {
  id: string;
  tenantId: string;
  startTime: Date;
  endTime: Date;
  durationMinutes?: number;
  timezone?: string;
  notes?: string | null;

  actorId: string;
  requestId: string;
}

export interface CancelAppointmentParams {
  id: string;
  tenantId: string;
  cancellationReason?: string | null;

  actorId: string;
  requestId: string;
}

export interface ListAppointmentsParams {
  tenantId: string;
  clinicId?: string;
  doctorId?: string;
  patientId?: string;
  status?: AppointmentStatus;
  source?: AppointmentSource;
  search?: string;
  startFrom?: Date;
  startTo?: Date;
  publicId?: string;
  page?: number;
  limit?: number;
  offset?: number;
  includeDeleted?: boolean;
}

export interface PaginatedAppointmentsResponse {
  appointments: SafeAppointment[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ---------------------------------------------------------------------------
// Service Interface
// ---------------------------------------------------------------------------

export interface IAppointmentService {
  createAppointment(params: CreateAppointmentParams): Promise<SafeAppointment>;
  updateAppointment(params: UpdateAppointmentParams): Promise<SafeAppointment>;
  rescheduleAppointment(params: RescheduleAppointmentParams): Promise<SafeAppointment>;
  cancelAppointment(params: CancelAppointmentParams): Promise<SafeAppointment>;
  confirmAppointment(id: string, tenantId: string, actorId: string, requestId: string): Promise<SafeAppointment>;
  checkInAppointment(id: string, tenantId: string, actorId: string, requestId: string): Promise<SafeAppointment>;
  startAppointment(id: string, tenantId: string, actorId: string, requestId: string): Promise<SafeAppointment>;
  completeAppointment(id: string, tenantId: string, actorId: string, requestId: string): Promise<SafeAppointment>;
  markNoShow(id: string, tenantId: string, actorId: string, requestId: string): Promise<SafeAppointment>;
  getAppointmentById(id: string, tenantId: string): Promise<SafeAppointment>;
  getAppointmentByPublicId(publicId: string, tenantId: string): Promise<SafeAppointment>;
  listAppointments(params: ListAppointmentsParams): Promise<SafeAppointment[] | PaginatedAppointmentsResponse>;
  getStatusCounters(tenantId: string, clinicId?: string): Promise<Record<string, number>>;
}

// ---------------------------------------------------------------------------
// Repository Interface
// ---------------------------------------------------------------------------

export interface IAppointmentRepository {
  create(data: {
    tenantId: string;
    clinicId: string;
    doctorId: string;
    patientId: string;
    startTime: Date;
    endTime: Date;
    timezone: string;
    status: AppointmentStatus;
    source: AppointmentSource;
    appointmentType?: string;
    durationMinutes?: number;
    notes?: string | null;
  }): Promise<unknown>;

  update(
    id: string,
    data: {
      startTime?: Date;
      endTime?: Date;
      durationMinutes?: number;
      timezone?: string;
      status?: AppointmentStatus;
      notes?: string | null;
      cancellationReason?: string | null;
      cancelledAt?: Date | null;
      deletedAt?: Date | null;
    },
  ): Promise<unknown>;

  findById(id: string, includeDeleted?: boolean): Promise<unknown | null>;
  findByPublicId(publicId: string, includeDeleted?: boolean): Promise<unknown | null>;

  findMany(params: {
    tenantId: string;
    clinicId?: string;
    doctorId?: string;
    patientId?: string;
    status?: AppointmentStatus;
    source?: AppointmentSource;
    search?: string;
    startFrom?: Date;
    startTo?: Date;
    publicId?: string;
    limit?: number;
    offset?: number;
    includeDeleted?: boolean;
  }): Promise<unknown[]>;

  countMany(params: {
    tenantId: string;
    clinicId?: string;
    doctorId?: string;
    patientId?: string;
    status?: AppointmentStatus;
    source?: AppointmentSource;
    search?: string;
    startFrom?: Date;
    startTo?: Date;
    publicId?: string;
    includeDeleted?: boolean;
  }): Promise<number>;

  getStatusCounters(tenantId: string, clinicId?: string): Promise<Record<string, number>>;

  /**
   * Returns appointments that overlap [startTime, endTime) for a given doctor
   * (excluding terminal statuses and the appointment with excludeId, if given).
   */
  findConflicts(params: {
    tenantId?: string;
    doctorId: string;
    clinicId: string;
    startTime: Date;
    endTime: Date;
    excludeId?: string;
  }): Promise<unknown[]>;

  /** Verify doctor exists and belongs to the same clinic & tenant */
  doctorBelongsToClinic(doctorId: string, clinicId: string, tenantId: string): Promise<boolean>;

  /** Verify patient exists and belongs to the same clinic & tenant */
  patientBelongsToClinic(patientId: string, clinicId: string, tenantId: string): Promise<boolean>;

  /** Verify clinic belongs to the tenant and is not suspended/deleted */
  clinicIsActive(clinicId: string, tenantId: string): Promise<boolean>;

  /** Fetch doctor status to verify it is active */
  getDoctorStatus(doctorId: string): Promise<string | null>;

  /** Fetch doctor details including workingHours, leaves, and clinic timezone */
  getDoctorDetails(doctorId: string): Promise<{
    id: string;
    status: string;
    workingHours: any;
    leaves: any;
    clinicId?: string;
    tenantId?: string;
    clinic?: { id: string; timezone: string } | null;
  } | null>;

  /** Fetch patient status to verify it is active */
  getPatientStatus(patientId: string): Promise<string | null>;

  /** Fetch doctor clinic ID */
  getDoctorClinicId(doctorId: string): Promise<string | null>;

  /** Fetch main clinic for tenant */
  findMainClinicForTenant(tenantId: string): Promise<unknown | null>;

  /** Atomic creation inside transaction with row lock */
  createWithAtomicConflictCheck?(data: {
    tenantId: string;
    clinicId: string;
    doctorId: string;
    patientId: string;
    startTime: Date;
    endTime: Date;
    timezone: string;
    status: AppointmentStatus;
    source: AppointmentSource;
    appointmentType?: string;
    durationMinutes?: number;
    notes?: string | null;
  }): Promise<unknown>;

  /** Atomic reschedule inside transaction with row lock */
  rescheduleWithAtomicConflictCheck?(
    id: string,
    data: {
      tenantId: string;
      doctorId: string;
      clinicId: string;
      startTime: Date;
      endTime: Date;
      durationMinutes?: number;
      timezone?: string;
      notes?: string | null;
    }
  ): Promise<unknown>;
}

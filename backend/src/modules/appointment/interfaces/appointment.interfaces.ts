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
  clinicId: string;
  doctorId: string;
  patientId: string;
  startTime: Date;
  endTime: Date;
  timezone: string;
  source: AppointmentSource;
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
  startFrom?: Date;
  startTo?: Date;
  publicId?: string;
  limit?: number;
  offset?: number;
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
  completeAppointment(id: string, tenantId: string, actorId: string, requestId: string): Promise<SafeAppointment>;
  markNoShow(id: string, tenantId: string, actorId: string, requestId: string): Promise<SafeAppointment>;
  getAppointmentById(id: string, tenantId: string): Promise<SafeAppointment>;
  getAppointmentByPublicId(publicId: string, tenantId: string): Promise<SafeAppointment>;
  listAppointments(params: ListAppointmentsParams): Promise<SafeAppointment[]>;
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
    notes?: string | null;
  }): Promise<unknown>;

  update(
    id: string,
    data: {
      startTime?: Date;
      endTime?: Date;
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
    startFrom?: Date;
    startTo?: Date;
    publicId?: string;
    limit?: number;
    offset?: number;
    includeDeleted?: boolean;
  }): Promise<unknown[]>;

  /**
   * Returns appointments that overlap [startTime, endTime) for a given doctor
   * (excluding terminal statuses and the appointment with excludeId, if given).
   */
  findConflicts(params: {
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

  /** Fetch patient status to verify it is active */
  getPatientStatus(patientId: string): Promise<string | null>;
}

/**
 * Appointment Module Types
 */

import type { AppointmentStatus, AppointmentSource } from '../constants/appointment.constants';

/**
 * Safe output representation of an Appointment record.
 * All database internals are sanitized and well-typed.
 */
export interface SafeAppointment {
  id: string;
  publicId: string;
  tenantId: string;
  clinicId: string;
  doctorId: string;
  patientId: string;

  startTime: Date;
  endTime: Date;
  timezone: string;
  status: AppointmentStatus;
  source: AppointmentSource;

  notes: string | null;
  cancellationReason: string | null;
  cancelledAt: Date | null;

  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

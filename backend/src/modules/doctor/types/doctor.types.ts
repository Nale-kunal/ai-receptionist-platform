/**
 * Doctor Module Types & Interfaces
 */

import type { DoctorStatus } from '../constants/doctor.constants';

export interface WorkingHourInterval {
  dayOfWeek: number; // 0-6 (Sunday-Saturday)
  openTime: string;  // e.g. "09:00"
  closeTime: string; // e.g. "17:00"
  isClosed: boolean;
}

export interface DoctorLeaveInterval {
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  reason?: string | null;
}

/**
 * Output representation of a Doctor.
 * Sanitizes and formats the raw database record.
 */
export interface SafeDoctor {
  id: string;
  publicId: string;
  tenantId: string;
  clinicId: string;

  fullName: string;
  displayName: string;
  specialization: string;
  licenseNumber: string | null;
  biography: string | null;
  email: string | null;
  phone: string | null;
  status: DoctorStatus;
  profilePhoto: string | null;

  workingHours: WorkingHourInterval[];
  leaves: DoctorLeaveInterval[];

  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

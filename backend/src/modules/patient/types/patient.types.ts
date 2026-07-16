/**
 * Patient Module Types & Interfaces
 */

import type { PatientStatus, ContactMethod } from '../constants/patient.constants';

export interface PatientEmergencyContact {
  name: string;
  relationship: string;
  phone: string;
}

/**
 * Output representation of a Patient.
 * Sanitizes and formats the raw database record.
 */
export interface SafePatient {
  id: string;
  publicId: string;
  tenantId: string;
  clinicId: string;

  fullName: string;
  phone: string;
  email: string | null;
  dateOfBirth: Date | null;
  gender: string | null;
  preferredLanguage: string;
  preferredContactMethod: ContactMethod;
  status: PatientStatus;
  emergencyContact: PatientEmergencyContact | null;

  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

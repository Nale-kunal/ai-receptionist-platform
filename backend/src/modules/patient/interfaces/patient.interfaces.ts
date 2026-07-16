/**
 * Patient Module Interfaces & Contracts
 */

import type { PatientStatus, ContactMethod } from '../constants/patient.constants';
import type { SafePatient, PatientEmergencyContact } from '../types/patient.types';

export interface CreatePatientParams {
  tenantId: string;
  clinicId: string;
  fullName: string;
  phone: string;
  email?: string | null;
  dateOfBirth?: string | Date | null;
  gender?: string | null;
  preferredLanguage?: string;
  preferredContactMethod?: ContactMethod;
  emergencyContact?: PatientEmergencyContact | null;
  
  actorId: string;
  requestId: string;
}

export interface UpdatePatientParams {
  id: string;
  tenantId: string;
  clinicId?: string;
  fullName?: string;
  phone?: string;
  email?: string | null;
  dateOfBirth?: string | Date | null;
  gender?: string | null;
  preferredLanguage?: string;
  preferredContactMethod?: ContactMethod;
  emergencyContact?: PatientEmergencyContact | null;
  
  actorId: string;
  requestId: string;
}

export interface IPatientService {
  createPatient(params: CreatePatientParams): Promise<SafePatient>;
  updatePatient(params: UpdatePatientParams): Promise<SafePatient>;
  getPatientById(id: string, tenantId: string): Promise<SafePatient>;
  getPatientByPublicId(publicId: string, tenantId: string): Promise<SafePatient>;
  listPatients(params: {
    tenantId: string;
    clinicId?: string;
    phone?: string;
    email?: string;
    fullName?: string;
    status?: PatientStatus;
    limit?: number;
    offset?: number;
  }): Promise<SafePatient[]>;
  transitionStatus(
    id: string,
    tenantId: string,
    targetStatus: PatientStatus,
    actorId: string,
    requestId: string,
  ): Promise<SafePatient>;
  softDeletePatient(id: string, tenantId: string, actorId: string, requestId: string): Promise<void>;
  restorePatient(id: string, tenantId: string, actorId: string, requestId: string): Promise<SafePatient>;
}

export interface IPatientRepository {
  create(data: {
    tenantId: string;
    clinicId: string;
    fullName: string;
    phone: string;
    email?: string | null;
    dateOfBirth?: Date | null;
    gender?: string | null;
    preferredLanguage: string;
    preferredContactMethod: ContactMethod;
    status: PatientStatus;
    emergencyContact?: PatientEmergencyContact | null;
  }): Promise<unknown>;

  update(
    id: string,
    data: {
      clinicId?: string;
      fullName?: string;
      phone?: string;
      email?: string | null;
      dateOfBirth?: Date | null;
      gender?: string | null;
      preferredLanguage?: string;
      preferredContactMethod?: ContactMethod;
      status?: PatientStatus;
      emergencyContact?: PatientEmergencyContact | null;
      deletedAt?: Date | null;
    },
  ): Promise<unknown>;

  findById(id: string, includeDeleted?: boolean): Promise<unknown | null>;
  findByPublicId(publicId: string, includeDeleted?: boolean): Promise<unknown | null>;
  findByPhone(phone: string, clinicId: string): Promise<unknown | null>;
  findByEmail(email: string, clinicId: string): Promise<unknown | null>;
  findMany(params: {
    tenantId: string;
    clinicId?: string;
    phone?: string;
    email?: string;
    fullName?: string;
    status?: PatientStatus;
    limit?: number;
    offset?: number;
    includeDeleted?: boolean;
  }): Promise<unknown[]>;
  clinicBelongsToTenant(clinicId: string, tenantId: string): Promise<boolean>;
}

/**
 * Doctor Module Interfaces & Contracts
 */

import type { DoctorStatus } from '../constants/doctor.constants';
import type { SafeDoctor, WorkingHourInterval, DoctorLeaveInterval } from '../types/doctor.types';

export interface CreateDoctorParams {
  tenantId: string;
  clinicId: string;
  fullName: string;
  displayName: string;
  specialization: string;
  licenseNumber?: string | null;
  biography?: string | null;
  email?: string | null;
  phone?: string | null;
  profilePhoto?: string | null;
  
  workingHours?: WorkingHourInterval[];
  leaves?: DoctorLeaveInterval[];
  
  actorId: string;
  requestId: string;
}

export interface UpdateDoctorParams {
  id: string;
  tenantId: string;
  clinicId?: string;
  fullName?: string;
  displayName?: string;
  specialization?: string;
  licenseNumber?: string | null;
  biography?: string | null;
  email?: string | null;
  phone?: string | null;
  profilePhoto?: string | null;
  
  actorId: string;
  requestId: string;
}

export interface IDoctorService {
  createDoctor(params: CreateDoctorParams): Promise<SafeDoctor>;
  updateDoctor(params: UpdateDoctorParams): Promise<SafeDoctor>;
  getDoctorById(id: string, tenantId: string): Promise<SafeDoctor>;
  getDoctorByPublicId(publicId: string, tenantId: string): Promise<SafeDoctor>;
  listDoctors(params: {
    tenantId: string;
    clinicId?: string;
    status?: DoctorStatus;
    limit?: number;
    offset?: number;
  }): Promise<SafeDoctor[]>;
  transitionStatus(
    id: string,
    tenantId: string,
    targetStatus: DoctorStatus,
    actorId: string,
    requestId: string,
  ): Promise<SafeDoctor>;
  updateWorkingHours(
    id: string,
    tenantId: string,
    workingHours: WorkingHourInterval[],
    actorId: string,
    requestId: string,
  ): Promise<SafeDoctor>;
  updateLeaves(
    id: string,
    tenantId: string,
    leaves: DoctorLeaveInterval[],
    actorId: string,
    requestId: string,
  ): Promise<SafeDoctor>;
  softDeleteDoctor(id: string, tenantId: string, actorId: string, requestId: string): Promise<void>;
  restoreDoctor(id: string, tenantId: string, actorId: string, requestId: string): Promise<SafeDoctor>;
}

export interface IDoctorRepository {
  create(data: {
    tenantId: string;
    clinicId: string;
    fullName: string;
    displayName: string;
    specialization: string;
    licenseNumber?: string | null;
    biography?: string | null;
    email?: string | null;
    phone?: string | null;
    status: DoctorStatus;
    profilePhoto?: string | null;
    workingHours: WorkingHourInterval[];
    leaves: DoctorLeaveInterval[];
  }): Promise<unknown>;

  update(
    id: string,
    data: {
      clinicId?: string;
      fullName?: string;
      displayName?: string;
      specialization?: string;
      licenseNumber?: string | null;
      biography?: string | null;
      email?: string | null;
      phone?: string | null;
      status?: DoctorStatus;
      profilePhoto?: string | null;
      workingHours?: WorkingHourInterval[];
      leaves?: DoctorLeaveInterval[];
      deletedAt?: Date | null;
    },
  ): Promise<unknown>;

  findById(id: string, includeDeleted?: boolean): Promise<unknown | null>;
  findByPublicId(publicId: string, includeDeleted?: boolean): Promise<unknown | null>;
  findByLicenseNumber(licenseNumber: string, tenantId: string): Promise<unknown | null>;
  findMany(params: {
    tenantId: string;
    clinicId?: string;
    status?: DoctorStatus;
    limit?: number;
    offset?: number;
    includeDeleted?: boolean;
  }): Promise<unknown[]>;
  clinicBelongsToTenant(clinicId: string, tenantId: string): Promise<boolean>;
}

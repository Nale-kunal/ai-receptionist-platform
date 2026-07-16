/**
 * Doctor Repository
 *
 * Direct database access layer for the Doctor model via Prisma.
 */

import type { PrismaClient } from '@prisma/client';
import type { IDoctorRepository } from '../interfaces/doctor.interfaces';
import type { DoctorStatus } from '../constants/doctor.constants';
import type { WorkingHourInterval, DoctorLeaveInterval } from '../types/doctor.types';

export class DoctorRepository implements IDoctorRepository {
  constructor(private readonly prisma: PrismaClient) {}

  public async create(data: {
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
  }): Promise<any> {
    return this.prisma.doctor.create({
      data: {
        tenantId: data.tenantId,
        clinicId: data.clinicId,
        fullName: data.fullName,
        displayName: data.displayName,
        specialization: data.specialization,
        licenseNumber: data.licenseNumber ?? null,
        biography: data.biography ?? null,
        email: data.email ?? null,
        phone: data.phone ?? null,
        status: data.status,
        profilePhoto: data.profilePhoto ?? null,
        workingHours: data.workingHours as any,
        leaves: data.leaves as any,
      },
    });
  }

  public async update(
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
  ): Promise<any> {
    const updateData: any = { ...data };
    
    // Explicitly check for fields to avoid spreading undefined onto JSON fields
    if (data.workingHours !== undefined) {
      updateData.workingHours = data.workingHours as any;
    }
    if (data.leaves !== undefined) {
      updateData.leaves = data.leaves as any;
    }

    return this.prisma.doctor.update({
      where: { id },
      data: {
        ...updateData,
        updatedAt: new Date(),
      },
    });
  }

  public async findById(id: string, includeDeleted = false): Promise<any | null> {
    return this.prisma.doctor.findFirst({
      where: {
        id,
        ...(includeDeleted ? {} : { deletedAt: null }),
      },
    });
  }

  public async findByPublicId(publicId: string, includeDeleted = false): Promise<any | null> {
    return this.prisma.doctor.findFirst({
      where: {
        publicId,
        ...(includeDeleted ? {} : { deletedAt: null }),
      },
    });
  }

  public async findByLicenseNumber(licenseNumber: string, tenantId: string): Promise<any | null> {
    return this.prisma.doctor.findFirst({
      where: {
        licenseNumber,
        tenantId,
        deletedAt: null,
      },
    });
  }

  public async findMany(params: {
    tenantId: string;
    clinicId?: string;
    status?: DoctorStatus;
    limit?: number;
    offset?: number;
    includeDeleted?: boolean;
  }): Promise<any[]> {
    return this.prisma.doctor.findMany({
      where: {
        tenantId: params.tenantId,
        ...(params.clinicId ? { clinicId: params.clinicId } : {}),
        ...(params.status ? { status: params.status } : {}),
        ...(params.includeDeleted ? {} : { deletedAt: null }),
      },
      take: params.limit,
      skip: params.offset,
      orderBy: { createdAt: 'desc' },
    });
  }

  public async clinicBelongsToTenant(clinicId: string, tenantId: string): Promise<boolean> {
    const count = await this.prisma.clinic.count({
      where: {
        id: clinicId,
        tenantId,
        deletedAt: null,
      },
    });
    return count > 0;
  }
}

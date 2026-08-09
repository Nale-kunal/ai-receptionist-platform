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
    let doctors = await this.prisma.doctor.findMany({
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

    // Fail-safe Auto-Sync: If 0 doctor records exist in DB for tenant, auto-sync from Users table
    if (doctors.length === 0 && params.tenantId) {
      doctors = await this.autoSyncDoctorsFromTenantUsers(params.tenantId, params.clinicId);
    }

    return doctors;
  }

  private async autoSyncDoctorsFromTenantUsers(tenantId: string, requestedClinicId?: string): Promise<any[]> {
    try {
      // 1. Resolve or create baseline Clinic for Tenant
      let clinic = await this.prisma.clinic.findFirst({
        where: { tenantId, ...(requestedClinicId ? { id: requestedClinicId } : {}), deletedAt: null },
      });

      if (!clinic) {
        // Resolve tenant owner or active user to associate with clinic
        const tenantOwner = await this.prisma.user.findFirst({
          where: { tenantId, status: 'active' },
        });

        if (tenantOwner) {
          const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
          const clinicName = tenant ? `${tenant.name} Main Clinic` : 'Main Dental Clinic';
          clinic = await this.prisma.clinic.create({
            data: {
              tenantId,
              ownerId: tenantOwner.id,
              name: clinicName,
              slug: `clinic-${tenantId.substring(0, 8)}-${Math.floor(Math.random() * 1000)}`,
              timezone: tenant?.timezone || 'UTC',
              country: tenant?.country || 'US',
              status: 'active',
            },
          });
        }
      }

      if (!clinic) return [];

      // 2. Query active users in tenant with doctor/owner roles
      const eligibleUsers = await this.prisma.user.findMany({
        where: {
          tenantId,
          status: 'active',
          role: { in: ['doctor', 'dentist', 'clinic_owner', 'tenant_owner', 'admin'] },
        },
      });

      const defaultWorkingHours = [
        { day: 'monday', start: '09:00', end: '17:00', breakStart: '12:00', breakEnd: '13:00' },
        { day: 'tuesday', start: '09:00', end: '17:00', breakStart: '12:00', breakEnd: '13:00' },
        { day: 'wednesday', start: '09:00', end: '17:00', breakStart: '12:00', breakEnd: '13:00' },
        { day: 'thursday', start: '09:00', end: '17:00', breakStart: '12:00', breakEnd: '13:00' },
        { day: 'friday', start: '09:00', end: '17:00', breakStart: '12:00', breakEnd: '13:00' },
      ];

      if (eligibleUsers.length > 0) {
        const emails = eligibleUsers.map((u) => u.email).filter(Boolean);
        const existingDocs = await this.prisma.doctor.findMany({
          where: { tenantId, email: { in: emails }, deletedAt: null },
          select: { email: true },
        });
        const existingEmailSet = new Set(existingDocs.map((d) => d.email));

        const newDoctorsData = eligibleUsers
          .filter((u) => u.email && !existingEmailSet.has(u.email))
          .map((u) => {
            const fullName = [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email;
            const displayName = u.firstName ? `Dr. ${u.firstName} ${u.lastName}`.trim() : `Dr. ${fullName}`;
            return {
              tenantId,
              clinicId: clinic.id,
              fullName,
              displayName,
              specialization: 'General Dentistry',
              email: u.email,
              status: 'active',
              workingHours: defaultWorkingHours as any,
              leaves: [] as any,
            };
          });

        if (newDoctorsData.length > 0) {
          await this.prisma.doctor.createMany({
            data: newDoctorsData,
            skipDuplicates: true,
          });
        }
      }

      // Re-fetch created doctor records
      return this.prisma.doctor.findMany({
        where: { tenantId, clinicId: clinic.id, status: 'active', deletedAt: null },
        orderBy: { createdAt: 'desc' },
      });
    } catch (err) {
      console.error('[DoctorRepository] Error in autoSyncDoctorsFromTenantUsers:', err);
      return [];
    }
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

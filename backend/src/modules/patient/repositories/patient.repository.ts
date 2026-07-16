/**
 * Patient Repository
 *
 * Database access layer for the Patient model via Prisma.
 */

import type { PrismaClient } from '@prisma/client';
import type { IPatientRepository } from '../interfaces/patient.interfaces';
import type { PatientStatus, ContactMethod } from '../constants/patient.constants';
import type { PatientEmergencyContact } from '../types/patient.types';

export class PatientRepository implements IPatientRepository {
  constructor(private readonly prisma: PrismaClient) {}

  public async create(data: {
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
  }): Promise<any> {
    return this.prisma.patient.create({
      data: {
        tenantId: data.tenantId,
        clinicId: data.clinicId,
        fullName: data.fullName,
        phone: data.phone,
        email: data.email ?? null,
        dateOfBirth: data.dateOfBirth ?? null,
        gender: data.gender ?? null,
        preferredLanguage: data.preferredLanguage,
        preferredContactMethod: data.preferredContactMethod,
        status: data.status,
        emergencyContact: data.emergencyContact ? (data.emergencyContact as any) : null,
      },
    });
  }

  public async update(
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
  ): Promise<any> {
    const updateData: any = { ...data };

    if (data.emergencyContact !== undefined) {
      updateData.emergencyContact = data.emergencyContact ? (data.emergencyContact as any) : null;
    }

    return this.prisma.patient.update({
      where: { id },
      data: {
        ...updateData,
        updatedAt: new Date(),
      },
    });
  }

  public async findById(id: string, includeDeleted = false): Promise<any | null> {
    return this.prisma.patient.findFirst({
      where: {
        id,
        ...(includeDeleted ? {} : { deletedAt: null }),
      },
    });
  }

  public async findByPublicId(publicId: string, includeDeleted = false): Promise<any | null> {
    return this.prisma.patient.findFirst({
      where: {
        publicId,
        ...(includeDeleted ? {} : { deletedAt: null }),
      },
    });
  }

  public async findByPhone(phone: string, clinicId: string): Promise<any | null> {
    return this.prisma.patient.findFirst({
      where: {
        phone,
        clinicId,
        deletedAt: null,
      },
    });
  }

  public async findByEmail(email: string, clinicId: string): Promise<any | null> {
    return this.prisma.patient.findFirst({
      where: {
        email,
        clinicId,
        deletedAt: null,
      },
    });
  }

  public async findMany(params: {
    tenantId: string;
    clinicId?: string;
    phone?: string;
    email?: string;
    fullName?: string;
    status?: PatientStatus;
    limit?: number;
    offset?: number;
    includeDeleted?: boolean;
  }): Promise<any[]> {
    return this.prisma.patient.findMany({
      where: {
        tenantId: params.tenantId,
        ...(params.clinicId ? { clinicId: params.clinicId } : {}),
        ...(params.phone ? { phone: { contains: params.phone } } : {}),
        ...(params.email ? { email: { contains: params.email } } : {}),
        ...(params.fullName ? { fullName: { contains: params.fullName, mode: 'insensitive' } } : {}),
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

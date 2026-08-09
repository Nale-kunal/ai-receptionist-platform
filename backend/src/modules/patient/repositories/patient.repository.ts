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
      select: {
        id: true,
        publicId: true,
        tenantId: true,
        clinicId: true,
        fullName: true,
        phone: true,
        email: true,
        dateOfBirth: true,
        status: true,
        createdAt: true,
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
      select: {
        id: true,
        publicId: true,
        tenantId: true,
        clinicId: true,
        fullName: true,
        phone: true,
        email: true,
        dateOfBirth: true,
        status: true,
        updatedAt: true,
      },
    });
  }

  public async findById(id: string, includeDeleted = false): Promise<any | null> {
    return this.prisma.patient.findFirst({
      where: {
        id,
        ...(includeDeleted ? {} : { deletedAt: null }),
      },
      select: {
        id: true,
        publicId: true,
        tenantId: true,
        clinicId: true,
        fullName: true,
        firstName: true,
        lastName: true,
        mrn: true,
        phone: true,
        email: true,
        dateOfBirth: true,
        gender: true,
        status: true,
        preferredLanguage: true,
        preferredContactMethod: true,
        emergencyContact: true,
        notes: true,
        createdAt: true,
        updatedAt: true,
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
    search?: string;
    status?: PatientStatus;
    limit?: number;
    offset?: number;
    includeDeleted?: boolean;
  }): Promise<any[]> {
    const { search, tenantId, clinicId, phone, email, fullName, status, includeDeleted, limit, offset } = params;

    const searchCondition = search
      ? {
          OR: [
            { fullName: { contains: search, mode: 'insensitive' as const } },
            { firstName: { contains: search, mode: 'insensitive' as const } },
            { lastName: { contains: search, mode: 'insensitive' as const } },
            { phone: { contains: search } },
            { email: { contains: search, mode: 'insensitive' as const } },
            { mrn: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {};

    return this.prisma.patient.findMany({
      where: {
        tenantId,
        ...(clinicId ? { clinicId } : {}),
        ...(phone ? { phone: { contains: phone } } : {}),
        ...(email ? { email: { contains: email } } : {}),
        ...(fullName ? { fullName: { contains: fullName, mode: 'insensitive' } } : {}),
        ...(status ? { status } : {}),
        ...(includeDeleted ? {} : { deletedAt: null }),
        ...searchCondition,
      },
      select: {
        id: true,
        publicId: true,
        tenantId: true,
        clinicId: true,
        fullName: true,
        firstName: true,
        lastName: true,
        mrn: true,
        phone: true,
        email: true,
        dateOfBirth: true,
        gender: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
      take: limit,
      skip: offset,
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

  public async findMainClinicForTenant(tenantId: string): Promise<any | null> {
    return this.prisma.clinic.findFirst({
      where: {
        tenantId,
        deletedAt: null,
      },
      orderBy: { createdAt: 'asc' },
    });
  }
}

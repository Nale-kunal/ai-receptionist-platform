/**
 * Appointment Repository
 *
 * Database access layer for the Appointment model via Prisma.
 * Contains all scheduling queries including conflict detection.
 */

import type { PrismaClient } from '@prisma/client';
import type { IAppointmentRepository } from '../interfaces/appointment.interfaces';
import type { AppointmentStatus, AppointmentSource } from '../constants/appointment.constants';

/** Non-terminal statuses used for conflict detection */
const ACTIVE_STATUSES: AppointmentStatus[] = [
  'pending',
  'confirmed',
  'rescheduled',
] satisfies AppointmentStatus[];

export class AppointmentRepository implements IAppointmentRepository {
  constructor(private readonly prisma: PrismaClient) {}

  public async create(data: {
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
  }): Promise<any> {
    return this.prisma.appointment.create({
      data: {
        tenantId:  data.tenantId,
        clinicId:  data.clinicId,
        doctorId:  data.doctorId,
        patientId: data.patientId,
        startTime: data.startTime,
        endTime:   data.endTime,
        timezone:  data.timezone,
        status:    data.status,
        source:    data.source,
        notes:     data.notes ?? null,
      },
    });
  }

  public async update(
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
  ): Promise<any> {
    return this.prisma.appointment.update({
      where: { id },
      data: {
        ...data,
        updatedAt: new Date(),
      },
    });
  }

  public async findById(id: string, includeDeleted = false): Promise<any | null> {
    return this.prisma.appointment.findFirst({
      where: {
        id,
        ...(includeDeleted ? {} : { deletedAt: null }),
      },
    });
  }

  public async findByPublicId(publicId: string, includeDeleted = false): Promise<any | null> {
    return this.prisma.appointment.findFirst({
      where: {
        publicId,
        ...(includeDeleted ? {} : { deletedAt: null }),
      },
    });
  }

  public async findMany(params: {
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
  }): Promise<any[]> {
    return this.prisma.appointment.findMany({
      where: {
        tenantId: params.tenantId,
        ...(params.clinicId  ? { clinicId:  params.clinicId  } : {}),
        ...(params.doctorId  ? { doctorId:  params.doctorId  } : {}),
        ...(params.patientId ? { patientId: params.patientId } : {}),
        ...(params.status    ? { status:    params.status    } : {}),
        ...(params.source    ? { source:    params.source    } : {}),
        ...(params.publicId  ? { publicId:  params.publicId  } : {}),
        ...(params.startFrom || params.startTo
          ? {
              startTime: {
                ...(params.startFrom ? { gte: params.startFrom } : {}),
                ...(params.startTo   ? { lte: params.startTo   } : {}),
              },
            }
          : {}),
        ...(params.includeDeleted ? {} : { deletedAt: null }),
      },
      take: params.limit,
      skip: params.offset,
      orderBy: { startTime: 'asc' },
    });
  }

  /**
   * Overlap detection: returns appointments for a doctor that overlap [startTime, endTime).
   * Only non-terminal appointments are considered.
   * Excludes the appointment identified by excludeId (for reschedule self-overlap).
   */
  public async findConflicts(params: {
    doctorId: string;
    clinicId: string;
    startTime: Date;
    endTime: Date;
    excludeId?: string;
  }): Promise<any[]> {
    return this.prisma.appointment.findMany({
      where: {
        doctorId: params.doctorId,
        clinicId: params.clinicId,
        deletedAt: null,
        status: { in: ACTIVE_STATUSES },
        ...(params.excludeId ? { id: { not: params.excludeId } } : {}),
        // Overlap condition: existing.startTime < newEndTime AND existing.endTime > newStartTime
        startTime: { lt: params.endTime },
        endTime:   { gt: params.startTime },
      },
      take: 1, // We only need to know IF a conflict exists
    });
  }

  public async doctorBelongsToClinic(
    doctorId: string,
    clinicId: string,
    tenantId: string,
  ): Promise<boolean> {
    const count = await this.prisma.doctor.count({
      where: { id: doctorId, clinicId, tenantId, deletedAt: null },
    });
    return count > 0;
  }

  public async patientBelongsToClinic(
    patientId: string,
    clinicId: string,
    tenantId: string,
  ): Promise<boolean> {
    const count = await this.prisma.patient.count({
      where: { id: patientId, clinicId, tenantId, deletedAt: null },
    });
    return count > 0;
  }

  public async clinicIsActive(clinicId: string, tenantId: string): Promise<boolean> {
    const count = await this.prisma.clinic.count({
      where: {
        id: clinicId,
        tenantId,
        deletedAt: null,
        status: { notIn: ['suspended', 'deleted'] },
      },
    });
    return count > 0;
  }

  public async getDoctorStatus(doctorId: string): Promise<string | null> {
    const doctor = await this.prisma.doctor.findFirst({
      where: { id: doctorId, deletedAt: null },
      select: { status: true },
    });
    return doctor?.status ?? null;
  }

  public async getPatientStatus(patientId: string): Promise<string | null> {
    const patient = await this.prisma.patient.findFirst({
      where: { id: patientId, deletedAt: null },
      select: { status: true },
    });
    return patient?.status ?? null;
  }
}

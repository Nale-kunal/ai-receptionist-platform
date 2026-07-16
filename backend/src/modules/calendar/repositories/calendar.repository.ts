/**
 * Calendar Repository
 *
 * Database access layer for Calendar connections, event mappings, sync logs,
 * and related checks via Prisma.
 * Pure storage — no business logic.
 */

import type { PrismaClient } from '@prisma/client';
import type { ICalendarRepository } from '../interfaces/calendar.interfaces';
import type { CalendarProvider, CalendarConnectionStatus } from '../constants/calendar.constants';

export class CalendarRepository implements ICalendarRepository {
  constructor(private readonly prisma: PrismaClient) {}

  public async createConnection(data: {
    tenantId: string;
    clinicId: string;
    doctorId?: string | null;
    provider: CalendarProvider;
    calendarId: string;
    connectionStatus: CalendarConnectionStatus;
    accessToken: string;
    refreshToken?: string | null;
    tokenExpiry?: Date | null;
  }): Promise<unknown> {
    return this.prisma.calendarConnection.create({
      data: {
        tenantId:         data.tenantId,
        clinicId:         data.clinicId,
        doctorId:         data.doctorId ?? null,
        provider:         data.provider,
        calendarId:       data.calendarId,
        connectionStatus: data.connectionStatus,
        accessToken:      data.accessToken,
        refreshToken:     data.refreshToken ?? null,
        tokenExpiry:      data.tokenExpiry ?? null,
      },
    });
  }

  public async updateConnection(
    id: string,
    data: {
      connectionStatus?: CalendarConnectionStatus;
      lastSyncTime?: Date | null;
      accessToken?: string;
      refreshToken?: string | null;
      tokenExpiry?: Date | null;
      syncToken?: string | null;
      deletedAt?: Date | null;
    },
  ): Promise<unknown> {
    return this.prisma.calendarConnection.update({
      where: { id },
      data: {
        ...data,
        updatedAt: new Date(),
      },
    });
  }

  public async findConnectionById(id: string, includeDeleted = false): Promise<unknown | null> {
    return this.prisma.calendarConnection.findFirst({
      where: {
        id,
        ...(includeDeleted ? {} : { deletedAt: null }),
      },
    });
  }

  public async findConnectionByPublicId(publicId: string, includeDeleted = false): Promise<unknown | null> {
    return this.prisma.calendarConnection.findFirst({
      where: {
        publicId,
        ...(includeDeleted ? {} : { deletedAt: null }),
      },
    });
  }

  public async findConnections(params: {
    tenantId: string;
    clinicId?: string;
    doctorId?: string;
    provider?: CalendarProvider;
    status?: CalendarConnectionStatus;
    limit?: number;
    offset?: number;
    includeDeleted?: boolean;
  }): Promise<unknown[]> {
    return this.prisma.calendarConnection.findMany({
      where: {
        tenantId: params.tenantId,
        ...(params.clinicId  ? { clinicId:         params.clinicId  } : {}),
        ...(params.doctorId  ? { doctorId:         params.doctorId  } : {}),
        ...(params.provider  ? { provider:         params.provider  } : {}),
        ...(params.status    ? { connectionStatus: params.status    } : {}),
        ...(params.includeDeleted ? {} : { deletedAt: null }),
      },
      take:    params.limit,
      skip:    params.offset,
      orderBy: { createdAt: 'desc' },
    });
  }

  public async findActiveConnectionsForClinic(clinicId: string, tenantId: string): Promise<unknown[]> {
    return this.prisma.calendarConnection.findMany({
      where: {
        clinicId,
        tenantId,
        connectionStatus: 'connected',
        deletedAt:        null,
      },
    });
  }

  public async createMapping(data: {
    tenantId: string;
    clinicId: string;
    calendarConnectionId: string;
    appointmentId: string;
    externalEventId: string;
  }): Promise<unknown> {
    return this.prisma.calendarEventMapping.create({
      data: {
        tenantId:             data.tenantId,
        clinicId:             data.clinicId,
        calendarConnectionId: data.calendarConnectionId,
        appointmentId:        data.appointmentId,
        externalEventId:      data.externalEventId,
      },
    });
  }

  public async findMapping(connectionId: string, appointmentId: string): Promise<unknown | null> {
    return this.prisma.calendarEventMapping.findUnique({
      where: {
        calendarConnectionId_appointmentId: {
          calendarConnectionId: connectionId,
          appointmentId,
        },
      },
    });
  }

  public async deleteMapping(connectionId: string, appointmentId: string): Promise<void> {
    await this.prisma.calendarEventMapping.delete({
      where: {
        calendarConnectionId_appointmentId: {
          calendarConnectionId: connectionId,
          appointmentId,
        },
      },
    }).catch(() => {}); // ignore not found errors
  }

  public async createSyncLog(data: {
    tenantId: string;
    clinicId: string;
    calendarConnectionId: string;
    direction: 'push' | 'pull';
    status: 'success' | 'failed';
    appointmentId?: string | null;
    details?: string | null;
    errorDetails?: string | null;
  }): Promise<unknown> {
    return this.prisma.calendarSyncLog.create({
      data: {
        tenantId:             data.tenantId,
        clinicId:             data.clinicId,
        calendarConnectionId: data.calendarConnectionId,
        direction:            data.direction,
        status:               data.status,
        appointmentId:        data.appointmentId ?? null,
        details:              data.details ?? null,
        errorDetails:         data.errorDetails ?? null,
      },
    });
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

  public async doctorBelongsToClinic(doctorId: string, clinicId: string, tenantId: string): Promise<boolean> {
    const count = await this.prisma.doctor.count({
      where: {
        id: doctorId,
        clinicId,
        tenantId,
        deletedAt: null,
      },
    });
    return count > 0;
  }

  public async getAppointmentWithPatient(appointmentId: string, tenantId: string): Promise<unknown | null> {
    return this.prisma.appointment.findFirst({
      where: {
        id: appointmentId,
        tenantId,
        deletedAt: null,
      },
      include: {
        patient: {
          select: {
            fullName: true,
          },
        },
      },
    });
  }
}

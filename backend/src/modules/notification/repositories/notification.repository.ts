/**
 * Notification Repository
 *
 * Database access layer for the Notification model and Patient preferences via Prisma.
 * Pure storage — no business logic.
 */

import type { PrismaClient } from '@prisma/client';
import type { INotificationRepository } from '../interfaces/notification.interfaces';
import type { NotificationChannel, NotificationStatus, NotificationType } from '../constants/notification.constants';
import type { NotificationPreferences } from '../types/notification.types';
import { Prisma } from '@prisma/client';

export class NotificationRepository implements INotificationRepository {
  constructor(private readonly prisma: PrismaClient) {}

  public async create(data: {
    tenantId: string;
    clinicId: string;
    patientId?: string | null;
    appointmentId?: string | null;
    conversationId?: string | null;
    recipient: string;
    channel: NotificationChannel;
    type: NotificationType;
    subject?: string | null;
    content: string;
    status: NotificationStatus;
    scheduledAt?: Date | null;
    variables?: Record<string, unknown> | null;
    metadata?: Record<string, unknown> | null;
  }): Promise<unknown> {
    return this.prisma.notification.create({
      data: {
        tenantId:       data.tenantId,
        clinicId:       data.clinicId,
        patientId:      data.patientId ?? null,
        appointmentId:  data.appointmentId ?? null,
        conversationId: data.conversationId ?? null,
        recipient:      data.recipient,
        channel:        data.channel,
        type:           data.type,
        subject:        data.subject ?? null,
        content:        data.content,
        status:         data.status,
        scheduledAt:    data.scheduledAt ?? null,
        variables:      (data.variables ?? {}) as Prisma.InputJsonValue,
        metadata:       (data.metadata ?? {}) as Prisma.InputJsonValue,
      },
    });
  }

  public async update(
    id: string,
    data: {
      status?: NotificationStatus;
      provider?: string | null;
      retryCount?: number;
      maxRetries?: number;
      failureReason?: string | null;
      scheduledAt?: Date | null;
      sentAt?: Date | null;
      deliveredAt?: Date | null;
      failedAt?: Date | null;
      deletedAt?: Date | null;
    },
  ): Promise<unknown> {
    return this.prisma.notification.update({
      where: { id },
      data: {
        ...data,
        updatedAt: new Date(),
      },
    });
  }

  public async findById(id: string, includeDeleted = false): Promise<unknown | null> {
    return this.prisma.notification.findFirst({
      where: {
        id,
        ...(includeDeleted ? {} : { deletedAt: null }),
      },
    });
  }

  public async findByPublicId(publicId: string, includeDeleted = false): Promise<unknown | null> {
    return this.prisma.notification.findFirst({
      where: {
        publicId,
        ...(includeDeleted ? {} : { deletedAt: null }),
      },
    });
  }

  public async findMany(params: {
    tenantId: string;
    clinicId?: string;
    patientId?: string;
    status?: NotificationStatus;
    channel?: NotificationChannel;
    type?: NotificationType;
    scheduledFrom?: Date;
    scheduledTo?: Date;
    limit?: number;
    offset?: number;
    includeDeleted?: boolean;
  }): Promise<unknown[]> {
    return this.prisma.notification.findMany({
      where: {
        tenantId: params.tenantId,
        ...(params.clinicId  ? { clinicId:  params.clinicId  } : {}),
        ...(params.patientId ? { patientId: params.patientId } : {}),
        ...(params.status    ? { status:    params.status    } : {}),
        ...(params.channel   ? { channel:   params.channel   } : {}),
        ...(params.type      ? { type:      params.type      } : {}),
        ...(params.scheduledFrom || params.scheduledTo
          ? {
              scheduledAt: {
                ...(params.scheduledFrom ? { gte: params.scheduledFrom } : {}),
                ...(params.scheduledTo   ? { lte: params.scheduledTo   } : {}),
              },
            }
          : {}),
        ...(params.includeDeleted ? {} : { deletedAt: null }),
      },
      take:    params.limit,
      skip:    params.offset,
      orderBy: { createdAt: 'desc' },
    });
  }

  public async findPendingForDelivery(limit: number): Promise<unknown[]> {
    const now = new Date();
    return this.prisma.notification.findMany({
      where: {
        // Include all non-terminal, non-cancelled, non-expired statuses.
        // 'pending' and 'queued' are the normal pre-delivery states.
        // 'sending' is included so that stale in-flight records from a crashed
        // worker can be detected and reset by the caller.
        status:    { in: ['pending', 'queued', 'sending'] },
        deletedAt: null,
        OR: [
          { scheduledAt: null },
          { scheduledAt: { lte: now } },
        ],
      },
      take:    limit,
      orderBy: { createdAt: 'asc' },
    });
  }

  public async getPatientPreferences(patientId: string, tenantId: string): Promise<unknown | null> {
    return this.prisma.patient.findFirst({
      where: { id: patientId, tenantId, deletedAt: null },
      select: {
        smsEnabled:             true,
        emailEnabled:           true,
        preferredLanguage:      true,
        preferredContactMethod: true,
      },
    });
  }

  public async updatePatientPreferences(
    patientId: string,
    tenantId: string,
    data: Partial<NotificationPreferences>,
  ): Promise<unknown> {
    return this.prisma.patient.update({
      where: { id: patientId },
      data: {
        ...(data.smsEnabled !== undefined ? { smsEnabled: data.smsEnabled } : {}),
        ...(data.emailEnabled !== undefined ? { emailEnabled: data.emailEnabled } : {}),
        ...(data.preferredLanguage !== undefined ? { preferredLanguage: data.preferredLanguage } : {}),
        ...(data.preferredContactMethod !== undefined ? { preferredContactMethod: data.preferredContactMethod } : {}),
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

  public async appointmentBelongsToClinic(
    appointmentId: string,
    clinicId: string,
    tenantId: string,
  ): Promise<boolean> {
    const count = await this.prisma.appointment.count({
      where: { id: appointmentId, clinicId, tenantId, deletedAt: null },
    });
    return count > 0;
  }

  public async conversationBelongsToClinic(
    conversationId: string,
    clinicId: string,
    tenantId: string,
  ): Promise<boolean> {
    const count = await this.prisma.conversation.count({
      where: { id: conversationId, clinicId, tenantId, deletedAt: null },
    });
    return count > 0;
  }
}

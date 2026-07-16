/**
 * Conversation Repository
 *
 * Database access layer for the Conversation model via Prisma.
 * Pure storage — no business logic.
 */

import type { PrismaClient } from '@prisma/client';
import type { IConversationRepository } from '../interfaces/conversation.interfaces';
import type { ConversationStatus } from '../constants/conversation.constants';
import type { TranscriptTurn, ConversationSummary } from '../types/conversation.types';
import { Prisma } from '@prisma/client';

export class ConversationRepository implements IConversationRepository {
  constructor(private readonly prisma: PrismaClient) {}

  public async create(data: {
    tenantId: string;
    clinicId: string;
    patientId?: string | null;
    doctorId?: string | null;
    appointmentId?: string | null;
    callSessionId: string;
    callerPhone?: string | null;
    startedAt: Date;
    status: ConversationStatus;
    language: string;
    metadata?: Record<string, unknown> | null;
  }): Promise<unknown> {
    return this.prisma.conversation.create({
      data: {
        tenantId:      data.tenantId,
        clinicId:      data.clinicId,
        patientId:     data.patientId ?? null,
        doctorId:      data.doctorId  ?? null,
        appointmentId: data.appointmentId ?? null,
        callSessionId: data.callSessionId,
        callerPhone:   data.callerPhone ?? null,
        startedAt:     data.startedAt,
        status:        data.status,
        language:      data.language,
        metadata:      (data.metadata ?? {}) as Prisma.InputJsonValue,
        transcript:    Prisma.JsonNull,
      },
    });
  }

  public async update(
    id: string,
    data: {
      patientId?: string | null;
      doctorId?: string | null;
      appointmentId?: string | null;
      status?: ConversationStatus;
      endedAt?: Date | null;
      durationSeconds?: number | null;
      transcript?: TranscriptTurn[];
      transcriptVersion?: number;
      summary?: ConversationSummary | null;
      extractedEntities?: Record<string, unknown> | null;
      intent?: string | null;
      sentiment?: string | null;
      recordingReference?: string | null;
      recordingProvider?: string | null;
      recordingStatus?: string | null;
      inputTokens?: number | null;
      outputTokens?: number | null;
      totalTokens?: number | null;
      estimatedCostUsd?: string | null;
      aiModel?: string | null;
      aiProvider?: string | null;
      metadata?: Record<string, unknown> | null;
      deletedAt?: Date | null;
    },
  ): Promise<unknown> {
    // Build Prisma-safe update payload — JSON fields need explicit casting
    const prismaData: Record<string, unknown> = { ...data };

    if (data.transcript !== undefined) {
      prismaData.transcript = data.transcript as unknown as Prisma.InputJsonValue;
    }
    if (data.summary !== undefined) {
      prismaData.summary = data.summary === null
        ? Prisma.JsonNull
        : (data.summary as unknown as Prisma.InputJsonValue);
    }
    if (data.extractedEntities !== undefined) {
      prismaData.extractedEntities = data.extractedEntities === null
        ? Prisma.JsonNull
        : (data.extractedEntities as unknown as Prisma.InputJsonValue);
    }
    if (data.metadata !== undefined) {
      prismaData.metadata = data.metadata === null
        ? Prisma.JsonNull
        : (data.metadata as unknown as Prisma.InputJsonValue);
    }
    if (data.estimatedCostUsd !== undefined) {
      prismaData.estimatedCostUsd = data.estimatedCostUsd === null
        ? null
        : new Prisma.Decimal(data.estimatedCostUsd);
    }

    return this.prisma.conversation.update({
      where: { id },
      data:  prismaData,
    });
  }

  public async findById(id: string, includeDeleted = false): Promise<unknown | null> {
    return this.prisma.conversation.findFirst({
      where: {
        id,
        ...(includeDeleted ? {} : { deletedAt: null }),
      },
    });
  }

  public async findByPublicId(publicId: string, includeDeleted = false): Promise<unknown | null> {
    return this.prisma.conversation.findFirst({
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
    doctorId?: string;
    appointmentId?: string;
    status?: ConversationStatus;
    intent?: string;
    language?: string;
    publicId?: string;
    callSessionId?: string;
    startedFrom?: Date;
    startedTo?: Date;
    limit?: number;
    offset?: number;
    includeDeleted?: boolean;
  }): Promise<unknown[]> {
    return this.prisma.conversation.findMany({
      where: {
        tenantId: params.tenantId,
        ...(params.clinicId      ? { clinicId:      params.clinicId      } : {}),
        ...(params.patientId     ? { patientId:     params.patientId     } : {}),
        ...(params.doctorId      ? { doctorId:      params.doctorId      } : {}),
        ...(params.appointmentId ? { appointmentId: params.appointmentId } : {}),
        ...(params.status        ? { status:        params.status        } : {}),
        ...(params.intent        ? { intent:        params.intent        } : {}),
        ...(params.language      ? { language:      params.language      } : {}),
        ...(params.publicId      ? { publicId:      params.publicId      } : {}),
        ...(params.callSessionId ? { callSessionId: params.callSessionId } : {}),
        ...(params.startedFrom || params.startedTo
          ? {
              startedAt: {
                ...(params.startedFrom ? { gte: params.startedFrom } : {}),
                ...(params.startedTo   ? { lte: params.startedTo   } : {}),
              },
            }
          : {}),
        ...(params.includeDeleted ? {} : { deletedAt: null }),
      },
      take:    params.limit,
      skip:    params.offset,
      orderBy: { startedAt: 'desc' },
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
}

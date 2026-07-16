/**
 * Prompt Audit Log Repository
 *
 * Immutable append-only audit trail for all prompt lifecycle events.
 */

import type { PrismaClient } from '@prisma/client';
import { Prisma } from '@prisma/client';
import type { IPromptAuditLogRepository } from '../interfaces/prompt-engine.interfaces';

export class PromptAuditLogRepository implements IPromptAuditLogRepository {
  constructor(private readonly prisma: PrismaClient) {}

  public async create(data: {
    tenantId: string;
    clinicId: string | null;
    promptId: string;
    promptType: string;
    promptVersion: number;
    eventType: string;
    actorId: string;
    requestId: string | null;
    metadata?: Record<string, unknown> | null;
  }): Promise<unknown> {
    return this.prisma.promptAuditLog.create({
      data: {
        tenantId:      data.tenantId,
        clinicId:      data.clinicId,
        promptId:      data.promptId,
        promptType:    data.promptType,
        promptVersion: data.promptVersion,
        eventType:     data.eventType,
        actorId:       data.actorId,
        requestId:     data.requestId,
        metadata:      (data.metadata ?? {}) as Prisma.InputJsonValue,
      },
    });
  }

  public async findMany(params: {
    tenantId: string;
    clinicId?: string | null;
    promptId?: string;
    limit?: number;
    offset?: number;
  }): Promise<unknown[]> {
    return this.prisma.promptAuditLog.findMany({
      where: {
        tenantId: params.tenantId,
        ...(params.clinicId !== undefined ? { clinicId: params.clinicId } : {}),
        ...(params.promptId ? { promptId: params.promptId } : {}),
      },
      orderBy: { occurredAt: 'desc' },
      take:   params.limit  ?? 50,
      skip:   params.offset ?? 0,
    });
  }
}

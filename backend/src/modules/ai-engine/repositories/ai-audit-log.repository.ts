/**
 * AI Audit Log Repository
 *
 * Database access layer for the AiAuditLog model via Prisma.
 */

import type { PrismaClient } from '@prisma/client';
import type { IAiAuditLogRepository } from '../interfaces/ai-engine.interfaces';
import { Prisma } from '@prisma/client';

export class AiAuditLogRepository implements IAiAuditLogRepository {
  constructor(private readonly prisma: PrismaClient) {}

  public async create(data: {
    tenantId: string;
    clinicId: string | null;
    conversationId: string;
    provider: string;
    eventType: string;
    requestId: string | null;
    metadata?: Record<string, unknown> | null;
  }): Promise<unknown> {
    return this.prisma.aiAuditLog.create({
      data: {
        tenantId:       data.tenantId,
        clinicId:       data.clinicId,
        conversationId: data.conversationId,
        provider:       data.provider,
        eventType:      data.eventType,
        requestId:      data.requestId,
        metadata:       (data.metadata ?? {}) as Prisma.InputJsonValue,
      },
    });
  }

  public async findMany(params: {
    tenantId: string;
    clinicId?: string | null;
    conversationId?: string;
    limit?: number;
    offset?: number;
  }): Promise<unknown[]> {
    return this.prisma.aiAuditLog.findMany({
      where: {
        tenantId: params.tenantId,
        ...(params.clinicId !== undefined ? { clinicId: params.clinicId } : {}),
        ...(params.conversationId ? { conversationId: params.conversationId } : {}),
      },
      take: params.limit,
      skip: params.offset,
      orderBy: { occurredAt: 'desc' },
    });
  }
}

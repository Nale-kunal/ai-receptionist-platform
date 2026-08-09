/**
 * WhatsApp Webhook Event Repository — Raw audit log (immutable)
 */

import type { PrismaClient } from '@prisma/client';

export interface CreateWebhookEventParams {
  providerEventId?: string;
  tenantId?: string;
  destinationPhone?: string;
  rawPayload: Record<string, unknown>;
  signatureHeader?: string;
  processingStatus?: string;
  errorDetails?: string;
  correlationId?: string;
}

export class WhatsAppWebhookEventRepository {
  constructor(private readonly prisma: PrismaClient) {}

  public async create(params: CreateWebhookEventParams): Promise<{ id: string }> {
    const record = await this.prisma.whatsAppWebhookEvent.create({
      data: {
        providerEventId: params.providerEventId,
        tenantId: params.tenantId,
        destinationPhone: params.destinationPhone,
        rawPayload: params.rawPayload as any,
        signatureHeader: params.signatureHeader,
        processingStatus: params.processingStatus ?? 'received',
        errorDetails: params.errorDetails,
        correlationId: params.correlationId,
      },
      select: { id: true },
    });
    return record;
  }

  public async updateStatus(id: string, status: string, errorDetails?: string): Promise<void> {
    await this.prisma.whatsAppWebhookEvent.update({
      where: { id },
      data: {
        processingStatus: status,
        ...(errorDetails && { errorDetails }),
      },
    });
  }
}

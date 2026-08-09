/**
 * WhatsApp Message Repository
 */

import type { PrismaClient } from '@prisma/client';
import { WHATSAPP_MSG_INBOUND } from '../constants/whatsapp.constants';

export interface CreateMessageParams {
  tenantId: string;
  clinicId: string;
  integrationId: string;
  conversationId?: string;
  providerMessageId: string;  // wamid
  direction: string;
  fromNumber: string;
  toNumber: string;
  messageType: string;
  content: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export class WhatsAppMessageRepository {
  constructor(private readonly prisma: PrismaClient) {}

  public async existsByProviderMessageId(providerMessageId: string): Promise<boolean> {
    const record = await this.prisma.whatsAppMessage.findUnique({
      where: { providerMessageId },
      select: { id: true },
    });
    return record !== null;
  }

  public async create(params: CreateMessageParams): Promise<any> {
    return this.prisma.whatsAppMessage.create({
      data: {
        tenantId: params.tenantId,
        clinicId: params.clinicId,
        integrationId: params.integrationId,
        conversationId: params.conversationId,
        providerMessageId: params.providerMessageId,
        direction: params.direction,
        fromNumber: params.fromNumber,
        toNumber: params.toNumber,
        messageType: params.messageType,
        content: params.content as any,
        metadata: (params.metadata ?? {}) as any,
        status: params.direction === WHATSAPP_MSG_INBOUND ? 'received' : 'sent',
        processingStatus: 'pending',
      },
    });
  }

  public async updateStatus(id: string, status: string, providerStatus?: string): Promise<void> {
    await this.prisma.whatsAppMessage.update({
      where: { id },
      data: {
        status,
        ...(providerStatus !== undefined && { providerStatus }),
      },
    });
  }

  public async markProcessed(id: string, conversationId?: string): Promise<void> {
    await this.prisma.whatsAppMessage.update({
      where: { id },
      data: {
        processingStatus: 'processed',
        ...(conversationId && { conversationId }),
      },
    });
  }

  public async updateByProviderMessageId(wamid: string, updates: Partial<{ status: string; providerStatus: string; conversationId: string }>): Promise<void> {
    await this.prisma.whatsAppMessage.update({
      where: { providerMessageId: wamid },
      data: updates,
    });
  }

  public async findByConversation(conversationId: string, limit = 20): Promise<any[]> {
    return this.prisma.whatsAppMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });
  }
}

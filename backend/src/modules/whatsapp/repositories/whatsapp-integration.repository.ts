/**
 * WhatsApp Integration Repository
 *
 * Data access for WhatsAppIntegration records.
 * All queries are scoped to tenantId.
 */

import type { PrismaClient } from '@prisma/client';
import type { SafeWhatsAppIntegration, WhatsAppIntegrationSettings, CreateWhatsAppIntegrationParams, UpdateWhatsAppIntegrationParams } from '../interfaces/whatsapp.interfaces';
import { DEFAULT_WHATSAPP_SETTINGS } from '../interfaces/whatsapp.interfaces';
import { WHATSAPP_INTEGRATION_STATUS_INACTIVE } from '../constants/whatsapp.constants';

export class WhatsAppIntegrationRepository {
  constructor(private readonly prisma: PrismaClient) {}

  public async findByPhoneNumber(phoneNumber: string): Promise<SafeWhatsAppIntegration | null> {
    const record = await this.prisma.whatsAppIntegration.findUnique({
      where: { phoneNumber },
    });
    return record ? this.toSafe(record) : null;
  }

  public async findByPhoneNumberId(phoneNumberId: string): Promise<SafeWhatsAppIntegration | null> {
    const record = await this.prisma.whatsAppIntegration.findUnique({
      where: { phoneNumberId },
    });
    return record ? this.toSafe(record) : null;
  }

  public async findActiveByPhoneNumber(phoneNumber: string): Promise<SafeWhatsAppIntegration | null> {
    const record = await this.prisma.whatsAppIntegration.findFirst({
      where: {
        phoneNumber,
        status: 'active',
        isEnabled: true,
        deletedAt: null,
      },
    });
    return record ? this.toSafe(record) : null;
  }

  public async findById(id: string, tenantId: string): Promise<SafeWhatsAppIntegration | null> {
    const record = await this.prisma.whatsAppIntegration.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    return record ? this.toSafe(record) : null;
  }

  public async findByClinic(tenantId: string, clinicId: string): Promise<SafeWhatsAppIntegration[]> {
    const records = await this.prisma.whatsAppIntegration.findMany({
      where: { tenantId, clinicId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    return records.map((r) => this.toSafe(r));
  }

  public async create(params: CreateWhatsAppIntegrationParams): Promise<SafeWhatsAppIntegration> {
    const settings = { ...DEFAULT_WHATSAPP_SETTINGS, ...params.settings };
    const record = await this.prisma.whatsAppIntegration.create({
      data: {
        tenantId: params.tenantId,
        clinicId: params.clinicId,
        phoneNumber: params.phoneNumber,
        phoneNumberId: params.phoneNumberId,
        wabaId: params.wabaId,
        displayName: params.displayName,
        webhookVerifyToken: params.webhookVerifyToken ?? null,
        status: WHATSAPP_INTEGRATION_STATUS_INACTIVE,
        isEnabled: false,
        wabaSubscribed: false,
        settings: settings as any,
      },
    });
    return this.toSafe(record);
  }

  public async update(params: UpdateWhatsAppIntegrationParams): Promise<SafeWhatsAppIntegration> {
    const existing = await this.prisma.whatsAppIntegration.findFirst({
      where: { id: params.id, tenantId: params.tenantId, clinicId: params.clinicId, deletedAt: null },
    });
    if (!existing) throw new Error('WhatsApp integration not found');

    const updatedSettings = params.settings
      ? { ...(existing.settings as object), ...params.settings }
      : existing.settings;

    const record = await this.prisma.whatsAppIntegration.update({
      where: { id: params.id },
      data: {
        ...(params.displayName !== undefined && { displayName: params.displayName }),
        ...(params.isEnabled !== undefined && { isEnabled: params.isEnabled }),
        settings: updatedSettings as any,
      },
    });
    return this.toSafe(record);
  }

  public async activate(id: string, tenantId: string): Promise<SafeWhatsAppIntegration> {
    const record = await this.prisma.whatsAppIntegration.update({
      where: { id },
      data: { status: 'active', isEnabled: true },
    });
    if (record.tenantId !== tenantId) throw new Error('Tenant isolation violation');
    return this.toSafe(record);
  }

  public async deactivate(id: string, tenantId: string): Promise<SafeWhatsAppIntegration> {
    const record = await this.prisma.whatsAppIntegration.update({
      where: { id },
      data: { status: 'inactive', isEnabled: false },
    });
    if (record.tenantId !== tenantId) throw new Error('Tenant isolation violation');
    return this.toSafe(record);
  }

  public async softDelete(id: string, tenantId: string): Promise<void> {
    await this.prisma.whatsAppIntegration.updateMany({
      where: { id, tenantId, deletedAt: null },
      data: { deletedAt: new Date(), status: 'inactive', isEnabled: false },
    });
  }

  private toSafe(record: any): SafeWhatsAppIntegration {
    return {
      id: record.id,
      publicId: record.publicId,
      tenantId: record.tenantId,
      clinicId: record.clinicId,
      phoneNumber: record.phoneNumber,
      phoneNumberId: record.phoneNumberId,
      wabaId: record.wabaId,
      displayName: record.displayName,
      status: record.status,
      isEnabled: record.isEnabled,
      wabaSubscribed: Boolean(record.wabaSubscribed),
      settings: { ...DEFAULT_WHATSAPP_SETTINGS, ...(record.settings as WhatsAppIntegrationSettings) },
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }
}

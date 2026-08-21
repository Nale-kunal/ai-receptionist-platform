/**
 * Configuration Repository
 *
 * Implements direct Postgres database updates via Prisma Client.
 */

import type { PrismaClient } from '@prisma/client';
import type { IConfigurationRepository } from '../interfaces/configuration.interfaces';

export class ConfigurationRepository implements IConfigurationRepository {
  constructor(private readonly prisma: PrismaClient) {}

  public async create(data: {
    tenantId: string;
    clinicId: string | null;
    version: number;
    isActive: boolean;
    createdBy: string;
    changeSummary?: string;
    previousVersionId?: string;
    rollbackFromVersion?: number;
    business: unknown;
    voice: unknown;
    ai: unknown;
    calendar: unknown;
    notification: unknown;
    branding: unknown;
    localization: unknown;
    featureFlags: unknown;
    providers: unknown;
  }): Promise<any> {
    return this.prisma.configuration.create({
      data: {
        tenantId: data.tenantId,
        clinicId: data.clinicId,
        version: data.version,
        isActive: data.isActive,
        createdBy: data.createdBy,
        changeSummary: data.changeSummary ?? null,
        previousVersionId: data.previousVersionId ?? null,
        rollbackFromVersion: data.rollbackFromVersion ?? null,
        business: data.business as any,
        voice: data.voice as any,
        ai: data.ai as any,
        calendar: data.calendar as any,
        notification: data.notification as any,
        branding: data.branding as any,
        localization: data.localization as any,
        featureFlags: data.featureFlags as any,
        providers: data.providers as any,
      },
    });
  }

  public async findActive(tenantId: string, clinicId: string | null): Promise<any | null> {
    return this.prisma.configuration.findFirst({
      where: {
        tenantId,
        clinicId,
        isActive: true,
      },
    });
  }

  public async findById(id: string): Promise<any | null> {
    return this.prisma.configuration.findFirst({
      where: { id },
    });
  }

  public async findLatestVersion(tenantId: string, clinicId: string | null): Promise<number> {
    const latest = await this.prisma.configuration.findFirst({
      where: {
        tenantId,
        clinicId,
      },
      orderBy: {
        version: 'desc',
      },
      select: {
        version: true,
      },
    });
    return latest?.version ?? 0;
  }

  public async findMany(
    tenantId: string,
    clinicId: string | null,
    limit?: number,
    offset?: number,
  ): Promise<any[]> {
    return this.prisma.configuration.findMany({
      where: {
        tenantId,
        clinicId,
      },
      take: limit,
      skip: offset,
      orderBy: {
        version: 'desc',
      },
    });
  }

  public async deactivateAll(tenantId: string, clinicId: string | null): Promise<void> {
    await this.prisma.configuration.updateMany({
      where: {
        tenantId,
        clinicId,
        isActive: true,
      },
      data: {
        isActive: false,
      },
    });
  }

  public async syncClinicAndTenant(
    tenantId: string,
    clinicId: string | null,
    updates: {
      name?: string;
      phone?: string;
      email?: string;
      address?: string;
      timezone?: string;
    },
  ): Promise<void> {
    const clinicUpdateData: Record<string, any> = {};
    if (updates.name && updates.name.trim().length > 0) {
      clinicUpdateData.name = updates.name.trim();
    }
    if (updates.phone !== undefined) {
      clinicUpdateData.primaryPhone = updates.phone;
    }
    if (updates.email !== undefined) {
      clinicUpdateData.primaryEmail = updates.email;
    }
    if (updates.address !== undefined) {
      clinicUpdateData.address = updates.address;
    }
    if (updates.timezone !== undefined && updates.timezone.trim().length > 0) {
      clinicUpdateData.timezone = updates.timezone.trim();
    }

    if (Object.keys(clinicUpdateData).length > 0) {
      let targetClinicId = clinicId;
      if (!targetClinicId) {
        const found = await this.prisma.clinic.findFirst({
          where: { tenantId, deletedAt: null },
          orderBy: { createdAt: 'asc' },
          select: { id: true },
        });
        if (found) {
          targetClinicId = found.id;
        }
      }

      if (targetClinicId) {
        await this.prisma.clinic.update({
          where: { id: targetClinicId },
          data: clinicUpdateData,
        });
      }

      const tenantUpdateData: Record<string, any> = {};
      if (clinicUpdateData.name) {
        tenantUpdateData.name = clinicUpdateData.name;
      }
      if (clinicUpdateData.timezone) {
        tenantUpdateData.timezone = clinicUpdateData.timezone;
      }
      if (Object.keys(tenantUpdateData).length > 0) {
        await this.prisma.tenant.update({
          where: { id: tenantId },
          data: tenantUpdateData,
        });
      }
    }
  }
}

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
}

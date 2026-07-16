/**
 * Clinic Repository
 *
 * Direct database access layer for the Clinic model via Prisma.
 */

import type { PrismaClient } from '@prisma/client';
import type { IClinicRepository } from '../interfaces/clinic.interfaces';
import type { ClinicStatus } from '../constants/clinic.constants';

export class ClinicRepository implements IClinicRepository {
  constructor(private readonly prisma: PrismaClient) {}

  public async create(data: {
    tenantId: string;
    ownerId: string;
    name: string;
    legalName?: string | null;
    slug: string;
    timezone: string;
    country: string;
    status: ClinicStatus;
    primaryEmail?: string | null;
    primaryPhone?: string | null;
    website?: string | null;
    address?: string | null;
    city?: string | null;
    state?: string | null;
    postalCode?: string | null;
    logoReference?: string | null;
    brandIdentifier?: string | null;
    subscriptionId?: string | null;
    planId?: string | null;
    subscriptionStatus?: string | null;
  }): Promise<any> {
    return this.prisma.clinic.create({
      data: {
        tenantId: data.tenantId,
        ownerId: data.ownerId,
        name: data.name,
        legalName: data.legalName ?? null,
        slug: data.slug,
        timezone: data.timezone,
        country: data.country,
        status: data.status,
        primaryEmail: data.primaryEmail ?? null,
        primaryPhone: data.primaryPhone ?? null,
        website: data.website ?? null,
        address: data.address ?? null,
        city: data.city ?? null,
        state: data.state ?? null,
        postalCode: data.postalCode ?? null,
        logoReference: data.logoReference ?? null,
        brandIdentifier: data.brandIdentifier ?? null,
        subscriptionId: data.subscriptionId ?? null,
        planId: data.planId ?? null,
        subscriptionStatus: data.subscriptionStatus ?? null,
      },
    });
  }

  public async update(
    id: string,
    data: {
      ownerId?: string;
      name?: string;
      legalName?: string | null;
      timezone?: string;
      country?: string;
      status?: ClinicStatus;
      primaryEmail?: string | null;
      primaryPhone?: string | null;
      website?: string | null;
      address?: string | null;
      city?: string | null;
      state?: string | null;
      postalCode?: string | null;
      logoReference?: string | null;
      brandIdentifier?: string | null;
      subscriptionId?: string | null;
      planId?: string | null;
      subscriptionStatus?: string | null;
      deletedAt?: Date | null;
    },
  ): Promise<any> {
    return this.prisma.clinic.update({
      where: { id },
      data: {
        ...data,
        updatedAt: new Date(),
      },
    });
  }

  public async findById(id: string, includeDeleted = false): Promise<any | null> {
    return this.prisma.clinic.findFirst({
      where: {
        id,
        ...(includeDeleted ? {} : { deletedAt: null }),
      },
    });
  }

  public async findBySlug(slug: string, includeDeleted = false): Promise<any | null> {
    return this.prisma.clinic.findFirst({
      where: {
        slug,
        ...(includeDeleted ? {} : { deletedAt: null }),
      },
    });
  }

  public async findMany(params: {
    tenantId: string;
    status?: ClinicStatus;
    limit?: number;
    offset?: number;
    includeDeleted?: boolean;
  }): Promise<any[]> {
    return this.prisma.clinic.findMany({
      where: {
        tenantId: params.tenantId,
        ...(params.status ? { status: params.status } : {}),
        ...(params.includeDeleted ? {} : { deletedAt: null }),
      },
      take: params.limit,
      skip: params.offset,
      orderBy: { createdAt: 'desc' },
    });
  }

  public async exists(slug: string): Promise<boolean> {
    const count = await this.prisma.clinic.count({
      where: {
        slug,
        deletedAt: null,
      },
    });
    return count > 0;
  }

  public async userBelongsToTenant(userId: string, tenantId: string): Promise<boolean> {
    const count = await this.prisma.user.count({
      where: {
        id: userId,
        tenantId,
        deletedAt: null,
      },
    });
    return count > 0;
  }
}

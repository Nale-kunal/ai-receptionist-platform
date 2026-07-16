/**
 * Tenant Repository
 *
 * Direct database access layer for the Tenant model via Prisma.
 * Implements the ITenantRepository contract.
 */

import type { PrismaClient, Tenant } from '@prisma/client';
import type { ITenantRepository } from '../interfaces/tenant.interfaces';
import type { TenantStatus, SubscriptionPlan } from '../constants/tenant.constants';

export class TenantRepository implements ITenantRepository {
  constructor(private readonly prisma: PrismaClient) {}

  public async create(data: {
    name: string;
    slug: string;
    status: TenantStatus;
    timezone: string;
    country: string;
    language: string;
    subscriptionPlan: SubscriptionPlan;
    branding?: unknown;
    metadata?: unknown;
  }): Promise<Tenant> {
    return this.prisma.tenant.create({
      data: {
        name: data.name,
        slug: data.slug,
        status: data.status,
        timezone: data.timezone,
        country: data.country,
        language: data.language,
        subscriptionPlan: data.subscriptionPlan,
        branding: (data.branding as any) ?? {},
        metadata: (data.metadata as any) ?? {},
      },
    });
  }

  public async update(
    id: string,
    data: {
      name?: string;
      status?: TenantStatus;
      timezone?: string;
      country?: string;
      language?: string;
      subscriptionPlan?: SubscriptionPlan;
      branding?: unknown;
      metadata?: unknown;
      deletedAt?: Date | null;
    },
  ): Promise<Tenant> {
    return this.prisma.tenant.update({
      where: { id },
      data: {
        ...data,
        branding: data.branding !== undefined ? (data.branding as any) : undefined,
        metadata: data.metadata !== undefined ? (data.metadata as any) : undefined,
        updatedAt: new Date(),
      },
    });
  }

  public async findById(id: string, includeDeleted = false): Promise<Tenant | null> {
    return this.prisma.tenant.findFirst({
      where: {
        id,
        ...(includeDeleted ? {} : { deletedAt: null }),
      },
    });
  }

  public async findBySlug(slug: string, includeDeleted = false): Promise<Tenant | null> {
    return this.prisma.tenant.findFirst({
      where: {
        slug,
        ...(includeDeleted ? {} : { deletedAt: null }),
      },
    });
  }

  public async findMany(params?: {
    status?: TenantStatus;
    limit?: number;
    offset?: number;
    includeDeleted?: boolean;
  }): Promise<Tenant[]> {
    return this.prisma.tenant.findMany({
      where: {
        ...(params?.status ? { status: params.status } : {}),
        ...(params?.includeDeleted ? {} : { deletedAt: null }),
      },
      take: params?.limit,
      skip: params?.offset,
      orderBy: { createdAt: 'desc' },
    });
  }

  public async exists(slug: string): Promise<boolean> {
    const count = await this.prisma.tenant.count({
      where: {
        slug,
        deletedAt: null,
      },
    });
    return count > 0;
  }
}

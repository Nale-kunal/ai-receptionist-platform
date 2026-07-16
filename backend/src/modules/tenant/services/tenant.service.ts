/**
 * Tenant Service
 *
 * Implements the core business logic, lifecycle transitions, validation rules,
 * and event dispatching for the Tenant module.
 */

import type { ITenantService, CreateTenantParams, UpdateTenantParams } from '../interfaces/tenant.interfaces';
import type { TenantRepository } from '../repositories/tenant.repository';
import type { SafeTenant } from '../types/tenant.types';
import {
  TENANT_STATUS_CREATED,
  TENANT_STATUS_PROVISIONED,
  TENANT_STATUS_ACTIVE,
  TENANT_STATUS_SUSPENDED,
  TENANT_STATUS_ARCHIVED,
  TENANT_STATUS_DELETED,
  DEFAULT_TIMEZONE,
  DEFAULT_COUNTRY,
  DEFAULT_LANGUAGE,
  SUBSCRIPTION_PLAN_FREE,
} from '../constants/tenant.constants';
import type { TenantStatus, SubscriptionPlan } from '../constants/tenant.constants';
import {
  TenantNotFoundError,
  DuplicateTenantSlugError,
  InvalidTenantStatusTransitionError,
} from '../errors/tenant.errors';
import type { ITenantEventPublisher } from '../events/tenant-event.publisher';
import type { Tenant } from '@prisma/client';

export class TenantService implements ITenantService {
  private static readonly ALLOWED_TRANSITIONS: Record<TenantStatus, TenantStatus[]> = {
    [TENANT_STATUS_CREATED]: [TENANT_STATUS_PROVISIONED, TENANT_STATUS_DELETED],
    [TENANT_STATUS_PROVISIONED]: [TENANT_STATUS_ACTIVE, TENANT_STATUS_DELETED],
    [TENANT_STATUS_ACTIVE]: [TENANT_STATUS_SUSPENDED, TENANT_STATUS_ARCHIVED, TENANT_STATUS_DELETED],
    [TENANT_STATUS_SUSPENDED]: [TENANT_STATUS_ACTIVE, TENANT_STATUS_DELETED],
    [TENANT_STATUS_ARCHIVED]: [TENANT_STATUS_ACTIVE, TENANT_STATUS_DELETED],
    [TENANT_STATUS_DELETED]: [TENANT_STATUS_ACTIVE], // restoration
  };

  constructor(
    private readonly tenantRepository: TenantRepository,
    private readonly eventPublisher: ITenantEventPublisher,
  ) {}

  public async createTenant(params: CreateTenantParams): Promise<SafeTenant> {
    const { name, slug, timezone, country, language, subscriptionPlan, branding, metadata, actorId, requestId } = params;

    // Validate slug uniqueness
    const exists = await this.tenantRepository.exists(slug);
    if (exists) {
      throw new DuplicateTenantSlugError(slug);
    }

    const tenant = await this.tenantRepository.create({
      name,
      slug,
      status: TENANT_STATUS_CREATED,
      timezone: timezone ?? DEFAULT_TIMEZONE,
      country: country ?? DEFAULT_COUNTRY,
      language: language ?? DEFAULT_LANGUAGE,
      subscriptionPlan: subscriptionPlan ?? SUBSCRIPTION_PLAN_FREE,
      branding: branding ?? {},
      metadata: metadata ?? {},
    });

    const safeTenant = this.mapToSafeTenant(tenant);

    // Publish event
    await this.eventPublisher.publish({
      eventType: 'tenant.created',
      occurredAt: new Date(),
      requestId,
      actorId,
      tenantId: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      timezone: tenant.timezone,
      country: tenant.country,
      language: tenant.language,
      subscriptionPlan: tenant.subscriptionPlan,
    });

    return safeTenant;
  }

  public async updateTenant(params: UpdateTenantParams): Promise<SafeTenant> {
    const { id, name, timezone, country, language, branding, metadata, actorId, requestId } = params;

    const existing = await this.tenantRepository.findById(id);
    if (!existing) {
      throw new TenantNotFoundError(id);
    }

    const updated = await this.tenantRepository.update(id, {
      name,
      timezone,
      country,
      language,
      branding,
      metadata,
    });

    const safeTenant = this.mapToSafeTenant(updated);

    await this.eventPublisher.publish({
      eventType: 'tenant.updated',
      occurredAt: new Date(),
      requestId,
      actorId,
      tenantId: id,
      name,
      timezone,
      country,
      language,
      branding: branding as Record<string, unknown>,
      metadata: metadata as Record<string, unknown>,
    });

    return safeTenant;
  }

  public async getTenantById(id: string): Promise<SafeTenant> {
    const tenant = await this.tenantRepository.findById(id);
    if (!tenant) {
      throw new TenantNotFoundError(id);
    }
    return this.mapToSafeTenant(tenant);
  }

  public async getTenantBySlug(slug: string): Promise<SafeTenant> {
    const tenant = await this.tenantRepository.findBySlug(slug);
    if (!tenant) {
      throw new TenantNotFoundError(slug);
    }
    return this.mapToSafeTenant(tenant);
  }

  public async listTenants(params?: {
    status?: TenantStatus;
    limit?: number;
    offset?: number;
  }): Promise<SafeTenant[]> {
    const tenants = await this.tenantRepository.findMany(params);
    return tenants.map((t) => this.mapToSafeTenant(t));
  }

  public async activateTenant(id: string, actorId: string, requestId: string): Promise<SafeTenant> {
    return this.transitionStatus(id, TENANT_STATUS_ACTIVE, actorId, requestId);
  }

  public async suspendTenant(id: string, actorId: string, requestId: string): Promise<SafeTenant> {
    return this.transitionStatus(id, TENANT_STATUS_SUSPENDED, actorId, requestId);
  }

  public async archiveTenant(id: string, actorId: string, requestId: string): Promise<SafeTenant> {
    return this.transitionStatus(id, TENANT_STATUS_ARCHIVED, actorId, requestId);
  }

  public async softDeleteTenant(id: string, actorId: string, requestId: string): Promise<SafeTenant> {
    const existing = await this.tenantRepository.findById(id);
    if (!existing) {
      throw new TenantNotFoundError(id);
    }

    this.validateTransition(existing.status as TenantStatus, TENANT_STATUS_DELETED);

    const updated = await this.tenantRepository.update(id, {
      status: TENANT_STATUS_DELETED,
      deletedAt: new Date(),
    });

    const safeTenant = this.mapToSafeTenant(updated);

    await this.eventPublisher.publish({
      eventType: 'tenant.deleted',
      occurredAt: new Date(),
      requestId,
      actorId,
      tenantId: id,
    });

    return safeTenant;
  }

  public async restoreTenant(id: string, actorId: string, requestId: string): Promise<SafeTenant> {
    const existing = await this.tenantRepository.findById(id, true); // Include deleted
    if (!existing) {
      throw new TenantNotFoundError(id);
    }

    if (existing.status !== TENANT_STATUS_DELETED) {
      throw new InvalidTenantStatusTransitionError(existing.status, TENANT_STATUS_ACTIVE);
    }

    const updated = await this.tenantRepository.update(id, {
      status: TENANT_STATUS_ACTIVE,
      deletedAt: null,
    });

    const safeTenant = this.mapToSafeTenant(updated);

    await this.eventPublisher.publish({
      eventType: 'tenant.restored',
      occurredAt: new Date(),
      requestId,
      actorId,
      tenantId: id,
    });

    return safeTenant;
  }

  public async updateSubscriptionPlan(
    id: string,
    plan: SubscriptionPlan,
    actorId: string,
    requestId: string,
  ): Promise<SafeTenant> {
    const existing = await this.tenantRepository.findById(id);
    if (!existing) {
      throw new TenantNotFoundError(id);
    }

    const oldPlan = existing.subscriptionPlan;
    const updated = await this.tenantRepository.update(id, {
      subscriptionPlan: plan,
    });

    const safeTenant = this.mapToSafeTenant(updated);

    await this.eventPublisher.publish({
      eventType: 'tenant.subscription-updated',
      occurredAt: new Date(),
      requestId,
      actorId,
      tenantId: id,
      oldPlan,
      newPlan: plan,
    });

    return safeTenant;
  }

  // --------------------------------------------------------------------------
  // Private Helper Methods
  // --------------------------------------------------------------------------

  private async transitionStatus(
    id: string,
    targetStatus: TenantStatus,
    actorId: string,
    requestId: string,
  ): Promise<SafeTenant> {
    const existing = await this.tenantRepository.findById(id);
    if (!existing) {
      throw new TenantNotFoundError(id);
    }

    const currentStatus = existing.status as TenantStatus;
    this.validateTransition(currentStatus, targetStatus);

    const updated = await this.tenantRepository.update(id, {
      status: targetStatus,
    });

    const safeTenant = this.mapToSafeTenant(updated);

    let eventType: TenantDomainEvent['eventType'];
    switch (targetStatus) {
      case TENANT_STATUS_ACTIVE:
        eventType = 'tenant.activated';
        break;
      case TENANT_STATUS_SUSPENDED:
        eventType = 'tenant.suspended';
        break;
      case TENANT_STATUS_ARCHIVED:
        eventType = 'tenant.archived';
        break;
      default:
        eventType = 'tenant.updated';
    }

    await this.eventPublisher.publish({
      eventType,
      occurredAt: new Date(),
      requestId,
      actorId,
      tenantId: id,
    } as any);

    return safeTenant;
  }

  private validateTransition(from: TenantStatus, to: TenantStatus): void {
    const allowed = TenantService.ALLOWED_TRANSITIONS[from] || [];
    if (!allowed.includes(to)) {
      throw new InvalidTenantStatusTransitionError(from, to);
    }
  }

  private mapToSafeTenant(tenant: Tenant): SafeTenant {
    return {
      id: tenant.id,
      publicId: tenant.publicId,
      name: tenant.name,
      slug: tenant.slug,
      status: tenant.status as TenantStatus,
      timezone: tenant.timezone,
      country: tenant.country,
      language: tenant.language,
      subscriptionPlan: tenant.subscriptionPlan as SubscriptionPlan,
      branding: (tenant.branding as any) ?? {},
      metadata: (tenant.metadata as any) ?? {},
      createdAt: tenant.createdAt,
      updatedAt: tenant.updatedAt,
    };
  }
}

import type { TenantDomainEvent } from '../events/tenant.events';

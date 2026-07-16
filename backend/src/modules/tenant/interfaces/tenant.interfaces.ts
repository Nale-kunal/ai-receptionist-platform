/**
 * Tenant Service & Repository Interfaces
 *
 * Exposes core contracts to decouple business logic from transport and storage adapters.
 */

import type { SafeTenant, TenantBranding, TenantMetadata } from '../types/tenant.types';
import type { TenantStatus, SubscriptionPlan } from '../constants/tenant.constants';

export interface CreateTenantParams {
  name: string;
  slug: string;
  timezone?: string;
  country?: string;
  language?: string;
  subscriptionPlan?: SubscriptionPlan;
  branding?: TenantBranding;
  metadata?: TenantMetadata;
  actorId: string;
  requestId: string;
}

export interface UpdateTenantParams {
  id: string;
  name?: string;
  timezone?: string;
  country?: string;
  language?: string;
  branding?: TenantBranding;
  metadata?: TenantMetadata;
  actorId: string;
  requestId: string;
}

export interface ITenantService {
  createTenant(params: CreateTenantParams): Promise<SafeTenant>;
  updateTenant(params: UpdateTenantParams): Promise<SafeTenant>;
  getTenantById(id: string): Promise<SafeTenant>;
  getTenantBySlug(slug: string): Promise<SafeTenant>;
  listTenants(params?: { status?: TenantStatus; limit?: number; offset?: number }): Promise<SafeTenant[]>;
  activateTenant(id: string, actorId: string, requestId: string): Promise<SafeTenant>;
  suspendTenant(id: string, actorId: string, requestId: string): Promise<SafeTenant>;
  archiveTenant(id: string, actorId: string, requestId: string): Promise<SafeTenant>;
  softDeleteTenant(id: string, actorId: string, requestId: string): Promise<SafeTenant>;
  restoreTenant(id: string, actorId: string, requestId: string): Promise<SafeTenant>;
  updateSubscriptionPlan(id: string, plan: SubscriptionPlan, actorId: string, requestId: string): Promise<SafeTenant>;
}

export interface ITenantRepository {
  create(data: {
    name: string;
    slug: string;
    status: TenantStatus;
    timezone: string;
    country: string;
    language: string;
    subscriptionPlan: SubscriptionPlan;
    branding?: unknown;
    metadata?: unknown;
  }): Promise<unknown>;
  
  update(id: string, data: {
    name?: string;
    status?: TenantStatus;
    timezone?: string;
    country?: string;
    language?: string;
    subscriptionPlan?: SubscriptionPlan;
    branding?: unknown;
    metadata?: unknown;
    deletedAt?: Date | null;
  }): Promise<unknown>;

  findById(id: string, includeDeleted?: boolean): Promise<unknown | null>;
  findBySlug(slug: string, includeDeleted?: boolean): Promise<unknown | null>;
  findMany(params?: { status?: TenantStatus; limit?: number; offset?: number; includeDeleted?: boolean }): Promise<unknown[]>;
  exists(slug: string): Promise<boolean>;
}

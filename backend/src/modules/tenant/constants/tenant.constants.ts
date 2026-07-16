/**
 * Tenant Constants
 *
 * Single source of truth for statuses, subscription plans, locales,
 * and routing paths for the Tenant module.
 */

export const TENANT_STATUS_CREATED = 'created' as const;
export const TENANT_STATUS_PROVISIONED = 'provisioned' as const;
export const TENANT_STATUS_ACTIVE = 'active' as const;
export const TENANT_STATUS_SUSPENDED = 'suspended' as const;
export const TENANT_STATUS_ARCHIVED = 'archived' as const;
export const TENANT_STATUS_DELETED = 'deleted' as const;

export const ALL_TENANT_STATUSES = [
  TENANT_STATUS_CREATED,
  TENANT_STATUS_PROVISIONED,
  TENANT_STATUS_ACTIVE,
  TENANT_STATUS_SUSPENDED,
  TENANT_STATUS_ARCHIVED,
  TENANT_STATUS_DELETED,
] as const;

export type TenantStatus = typeof ALL_TENANT_STATUSES[number];

export const SUBSCRIPTION_PLAN_FREE = 'free' as const;
export const SUBSCRIPTION_PLAN_BASIC = 'basic' as const;
export const SUBSCRIPTION_PLAN_PREMIUM = 'premium' as const;
export const SUBSCRIPTION_PLAN_ENTERPRISE = 'enterprise' as const;

export const ALL_SUBSCRIPTION_PLANS = [
  SUBSCRIPTION_PLAN_FREE,
  SUBSCRIPTION_PLAN_BASIC,
  SUBSCRIPTION_PLAN_PREMIUM,
  SUBSCRIPTION_PLAN_ENTERPRISE,
] as const;

export type SubscriptionPlan = typeof ALL_SUBSCRIPTION_PLANS[number];

export const TENANT_ROUTE_PREFIX = '/api/v1/tenants' as const;
export const DEFAULT_TIMEZONE = 'UTC' as const;
export const DEFAULT_COUNTRY = 'US' as const;
export const DEFAULT_LANGUAGE = 'en' as const;

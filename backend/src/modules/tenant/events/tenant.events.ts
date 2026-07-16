/**
 * Tenant Module Domain Events
 *
 * Fully typed, immutable domain event interfaces for audit trail integration.
 */

export interface BaseTenantEvent {
  readonly eventType: string;
  readonly occurredAt: Date;
  readonly requestId: string;
  readonly actorId: string;
  readonly tenantId: string;
}

export interface TenantCreatedEvent extends BaseTenantEvent {
  readonly eventType: 'tenant.created';
  readonly name: string;
  readonly slug: string;
  readonly timezone: string;
  readonly country: string;
  readonly language: string;
  readonly subscriptionPlan: string;
}

export interface TenantUpdatedEvent extends BaseTenantEvent {
  readonly eventType: 'tenant.updated';
  readonly name?: string;
  readonly timezone?: string;
  readonly country?: string;
  readonly language?: string;
  readonly branding?: Record<string, unknown>;
  readonly metadata?: Record<string, unknown>;
}

export interface TenantActivatedEvent extends BaseTenantEvent {
  readonly eventType: 'tenant.activated';
}

export interface TenantSuspendedEvent extends BaseTenantEvent {
  readonly eventType: 'tenant.suspended';
}

export interface TenantArchivedEvent extends BaseTenantEvent {
  readonly eventType: 'tenant.archived';
}

export interface TenantDeletedEvent extends BaseTenantEvent {
  readonly eventType: 'tenant.deleted';
}

export interface TenantRestoredEvent extends BaseTenantEvent {
  readonly eventType: 'tenant.restored';
}

export interface TenantSubscriptionUpdatedEvent extends BaseTenantEvent {
  readonly eventType: 'tenant.subscription-updated';
  readonly oldPlan: string;
  readonly newPlan: string;
}

export type TenantDomainEvent =
  | TenantCreatedEvent
  | TenantUpdatedEvent
  | TenantActivatedEvent
  | TenantSuspendedEvent
  | TenantArchivedEvent
  | TenantDeletedEvent
  | TenantRestoredEvent
  | TenantSubscriptionUpdatedEvent;

/**
 * Tenant Module - Public API
 *
 * This is the public interface of the Tenant module. All external modules
 * must import only from this barrel.
 */

// Constants
export {
  TENANT_STATUS_CREATED,
  TENANT_STATUS_PROVISIONED,
  TENANT_STATUS_ACTIVE,
  TENANT_STATUS_SUSPENDED,
  TENANT_STATUS_ARCHIVED,
  TENANT_STATUS_DELETED,
  ALL_TENANT_STATUSES,
  SUBSCRIPTION_PLAN_FREE,
  SUBSCRIPTION_PLAN_BASIC,
  SUBSCRIPTION_PLAN_PREMIUM,
  SUBSCRIPTION_PLAN_ENTERPRISE,
  ALL_SUBSCRIPTION_PLANS,
  TENANT_ROUTE_PREFIX,
  DEFAULT_TIMEZONE,
  DEFAULT_COUNTRY,
  DEFAULT_LANGUAGE,
} from './constants/tenant.constants';
export type { TenantStatus, SubscriptionPlan } from './constants/tenant.constants';

// Errors
export {
  TenantError,
  TenantNotFoundError,
  TenantSuspendedError,
  TenantArchivedError,
  DuplicateTenantSlugError,
  InvalidTenantStatusTransitionError,
  TenantAccessDeniedError,
  TenantIsolationViolationError,
} from './errors/tenant.errors';

// Types
export type {
  SafeTenant,
  TenantContext,
  TenantBranding,
  TenantMetadata,
} from './types/tenant.types';

// Interfaces
export type {
  ITenantService,
  ITenantRepository,
  CreateTenantParams,
  UpdateTenantParams,
} from './interfaces/tenant.interfaces';

// Events
export type {
  TenantDomainEvent,
  BaseTenantEvent,
  TenantCreatedEvent,
  TenantUpdatedEvent,
  TenantActivatedEvent,
  TenantSuspendedEvent,
  TenantArchivedEvent,
  TenantDeletedEvent,
  TenantRestoredEvent,
  TenantSubscriptionUpdatedEvent,
} from './events/tenant.events';

export { InProcessTenantEventPublisher } from './events/tenant-event.publisher';
export type { ITenantEventPublisher } from './events/tenant-event.publisher';

// Repositories
export { TenantRepository } from './repositories/tenant.repository';

// Services
export { TenantService } from './services/tenant.service';

// Controllers
export { TenantController, tenantErrorHandler } from './controllers/tenant.controller';

// Middleware
export { createTenantResolutionMiddleware, invalidateTenantResolutionCache } from './middleware/tenant-resolution.middleware';
export type { TenantResolverOptions } from './middleware/tenant-resolution.middleware';

// Routes
export { createTenantRouter } from './routes/tenant.routes';
export type { TenantRouterDeps } from './routes/tenant.routes';

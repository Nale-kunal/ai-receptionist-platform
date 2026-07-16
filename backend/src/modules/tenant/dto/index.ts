/**
 * Tenant DTO Barrel
 *
 * Re-exports Zod validation schemas and inferred types.
 */

export { CreateTenantSchema } from '../validators/create-tenant.validator';
export type { CreateTenantDTO } from '../validators/create-tenant.validator';

export { UpdateTenantSchema } from '../validators/update-tenant.validator';
export type { UpdateTenantDTO } from '../validators/update-tenant.validator';

export { UpdateTenantStatusSchema } from '../validators/update-status.validator';
export type { UpdateTenantStatusDTO } from '../validators/update-status.validator';

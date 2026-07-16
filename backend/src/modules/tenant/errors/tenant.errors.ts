/**
 * Tenant Module Errors
 *
 * Custom error classes for Tenant domain business rules and lifecycle constraints.
 * Extends the basic Error class with HTTP statuses and custom error codes.
 */

export class TenantError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = this.constructor.name;
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

export class TenantNotFoundError extends TenantError {
  constructor(identifier?: string) {
    super(
      identifier ? `Tenant not found for identifier: ${identifier}` : 'Tenant not found.',
      'TENANT_NOT_FOUND',
      404,
    );
  }
}

export class TenantSuspendedError extends TenantError {
  constructor() {
    super('Tenant has been suspended.', 'TENANT_SUSPENDED', 403);
  }
}

export class TenantArchivedError extends TenantError {
  constructor() {
    super('Tenant is archived and read-only.', 'TENANT_ARCHIVED', 403);
  }
}

export class DuplicateTenantSlugError extends TenantError {
  constructor(slug: string) {
    super(`Tenant slug "${slug}" is already registered.`, 'TENANT_SLUG_DUPLICATE', 409);
  }
}

export class InvalidTenantStatusTransitionError extends TenantError {
  constructor(from: string, to: string) {
    super(
      `Invalid tenant status transition from "${from}" to "${to}".`,
      'TENANT_INVALID_STATUS_TRANSITION',
      422,
    );
  }
}

export class TenantAccessDeniedError extends TenantError {
  constructor() {
    super('Access denied to this tenant.', 'TENANT_ACCESS_DENIED', 403);
  }
}

export class TenantIsolationViolationError extends TenantError {
  constructor() {
    super('Tenant isolation violation detected.', 'TENANT_ISOLATION_VIOLATION', 403);
  }
}

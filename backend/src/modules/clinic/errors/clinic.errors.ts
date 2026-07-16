/**
 * Clinic Module Custom Errors
 *
 * Mapped exceptions for security isolation and business logic validation.
 */

export class ClinicError extends Error {
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

export class ClinicNotFoundError extends ClinicError {
  constructor(id?: string) {
    super(
      id ? `Clinic not found for ID: ${id}` : 'Clinic not found.',
      'CLINIC_NOT_FOUND',
      404,
    );
  }
}

export class ClinicSuspendedError extends ClinicError {
  constructor() {
    super(
      'Clinic is suspended. Business operations are blocked.',
      'CLINIC_SUSPENDED',
      403,
    );
  }
}

export class ClinicArchivedError extends ClinicError {
  constructor() {
    super(
      'Clinic is archived and read-only.',
      'CLINIC_ARCHIVED',
      403,
    );
  }
}

export class DuplicateClinicSlugError extends ClinicError {
  constructor(slug: string) {
    super(`Clinic slug already in use: ${slug}`, 'DUPLICATE_CLINIC_SLUG', 409);
  }
}

export class InvalidClinicStatusTransitionError extends ClinicError {
  constructor(from: string, to: string) {
    super(
      `Invalid clinic lifecycle status transition from ${from} to ${to}`,
      'INVALID_CLINIC_STATUS_TRANSITION',
      422,
    );
  }
}

export class ClinicIsolationViolationError extends ClinicError {
  constructor() {
    super(
      'Access denied. Cross-tenant clinic isolation violation.',
      'CLINIC_ISOLATION_VIOLATION',
      403,
    );
  }
}

export class OwnerTenantMismatchError extends ClinicError {
  constructor() {
    super(
      'Invalid owner. Target user does not belong to this tenant.',
      'OWNER_TENANT_MISMATCH',
      422,
    );
  }
}

export class ClinicAccessDeniedError extends ClinicError {
  constructor(message = 'Access denied.') {
    super(message, 'CLINIC_ACCESS_DENIED', 403);
  }
}

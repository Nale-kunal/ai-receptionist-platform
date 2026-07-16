/**
 * Doctor Module Custom Errors
 *
 * Mapped exceptions for security isolation and business logic validation.
 */

export class DoctorError extends Error {
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

export class DoctorNotFoundError extends DoctorError {
  constructor(id?: string) {
    super(
      id ? `Doctor not found for ID: ${id}` : 'Doctor not found.',
      'DOCTOR_NOT_FOUND',
      404,
    );
  }
}

export class DoctorArchivedError extends DoctorError {
  constructor() {
    super(
      'Doctor is archived and read-only.',
      'DOCTOR_ARCHIVED',
      403,
    );
  }
}

export class DuplicateLicenseNumberError extends DoctorError {
  constructor(licenseNumber: string) {
    super(
      `Doctor license number already in use within this tenant: ${licenseNumber}`,
      'DUPLICATE_LICENSE_NUMBER',
      409,
    );
  }
}

export class InvalidDoctorStatusTransitionError extends DoctorError {
  constructor(from: string, to: string) {
    super(
      `Invalid doctor lifecycle status transition from ${from} to ${to}`,
      'INVALID_DOCTOR_STATUS_TRANSITION',
      422,
    );
  }
}

export class DoctorIsolationViolationError extends DoctorError {
  constructor() {
    super(
      'Access denied. Cross-tenant doctor isolation violation.',
      'DOCTOR_ISOLATION_VIOLATION',
      403,
    );
  }
}

export class ClinicTenantMismatchError extends DoctorError {
  constructor() {
    super(
      'Invalid clinic. Target clinic does not belong to this tenant.',
      'CLINIC_TENANT_MISMATCH',
      422,
    );
  }
}

export class DoctorAccessDeniedError extends DoctorError {
  constructor(message = 'Access denied.') {
    super(message, 'DOCTOR_ACCESS_DENIED', 403);
  }
}

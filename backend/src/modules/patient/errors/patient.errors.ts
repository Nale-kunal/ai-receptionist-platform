/**
 * Patient Module Custom Errors
 *
 * Mapped exceptions for security isolation and business logic validation.
 */

export class PatientError extends Error {
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

export class PatientNotFoundError extends PatientError {
  constructor(id?: string) {
    super(
      id ? `Patient not found for ID: ${id}` : 'Patient not found.',
      'PATIENT_NOT_FOUND',
      404,
    );
  }
}

export class PatientArchivedError extends PatientError {
  constructor() {
    super(
      'Patient is archived and read-only.',
      'PATIENT_ARCHIVED',
      403,
    );
  }
}

export class DuplicatePatientError extends PatientError {
  constructor(field: string, value: string) {
    super(
      `Patient already exists in this clinic with ${field}: ${value}`,
      'DUPLICATE_PATIENT',
      409,
    );
  }
}

/**
 * Soft 409 — email is shared by another patient, but the caller may
 * choose to proceed (e.g. family members sharing an inbox).
 * Carries the conflicting patient's name + id so the UI can surface them.
 */
export class DuplicateEmailWarning extends PatientError {
  constructor(
    public readonly existingPatientId: string,
    public readonly existingPatientName: string,
    email: string,
  ) {
    super(
      `Email ${email} is already associated with patient "${existingPatientName}".`,
      'EMAIL_IN_USE_WARNING',
      409,
      { existingPatientId, existingPatientName, email },
    );
  }
}

export class InvalidPatientStatusTransitionError extends PatientError {
  constructor(from: string, to: string) {
    super(
      `Invalid patient lifecycle status transition from ${from} to ${to}`,
      'INVALID_PATIENT_STATUS_TRANSITION',
      422,
    );
  }
}

export class PatientIsolationViolationError extends PatientError {
  constructor() {
    super(
      'Access denied. Cross-clinic or cross-tenant patient isolation violation.',
      'PATIENT_ISOLATION_VIOLATION',
      403,
    );
  }
}

export class ClinicTenantMismatchError extends PatientError {
  constructor() {
    super(
      'Invalid clinic. Target clinic does not belong to this tenant.',
      'CLINIC_TENANT_MISMATCH',
      422,
    );
  }
}

export class PatientAccessDeniedError extends PatientError {
  constructor(message = 'Access denied.') {
    super(message, 'PATIENT_ACCESS_DENIED', 403);
  }
}

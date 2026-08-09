/**
 * Appointment Module Custom Errors
 */

export class AppointmentError extends Error {
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

export class AppointmentNotFoundError extends AppointmentError {
  constructor(id?: string) {
    super(
      id ? `Appointment not found for ID: ${id}` : 'Appointment not found.',
      'APPOINTMENT_NOT_FOUND',
      404,
    );
  }
}

export class AppointmentConflictError extends AppointmentError {
  constructor() {
    super(
      'The requested time slot is already booked for this doctor.',
      'APPOINTMENT_CONFLICT',
      409,
    );
  }
}

export class AppointmentIsolationViolationError extends AppointmentError {
  constructor() {
    super(
      'Access denied. Cross-clinic or cross-tenant appointment isolation violation.',
      'APPOINTMENT_ISOLATION_VIOLATION',
      403,
    );
  }
}

export class InvalidAppointmentStatusTransitionError extends AppointmentError {
  constructor(from: string, to: string) {
    super(
      `Invalid appointment status transition from '${from}' to '${to}'.`,
      'INVALID_APPOINTMENT_STATUS_TRANSITION',
      422,
    );
  }
}

export class AppointmentAlreadyTerminalError extends AppointmentError {
  constructor(status: string) {
    super(
      `Appointment is in terminal status '${status}' and cannot be modified.`,
      'APPOINTMENT_TERMINAL_STATUS',
      422,
    );
  }
}

export class DoctorNotAvailableError extends AppointmentError {
  constructor(message?: string) {
    super(
      message || 'The selected doctor is not active and cannot accept appointments.',
      'DOCTOR_NOT_AVAILABLE',
      422,
    );
  }
}

export class PatientNotActiveError extends AppointmentError {
  constructor() {
    super(
      'The selected patient is not active and cannot book appointments.',
      'PATIENT_NOT_ACTIVE',
      422,
    );
  }
}

export class ClinicNotActiveError extends AppointmentError {
  constructor() {
    super(
      'The selected clinic is not active and cannot accept appointments.',
      'CLINIC_NOT_ACTIVE',
      422,
    );
  }
}

export class AppointmentTimeRangeError extends AppointmentError {
  constructor(message: string) {
    super(message, 'INVALID_APPOINTMENT_TIME_RANGE', 422);
  }
}

export class AppointmentOwnershipError extends AppointmentError {
  constructor() {
    super(
      'Doctor or patient does not belong to the specified clinic.',
      'APPOINTMENT_OWNERSHIP_ERROR',
      422,
    );
  }
}

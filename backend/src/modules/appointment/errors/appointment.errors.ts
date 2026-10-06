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
  constructor(message?: string, details?: Record<string, unknown>) {
    super(
      message || 'The requested time slot is already booked for this doctor.',
      'APPOINTMENT_CONFLICT',
      409,
      details,
    );
  }
}

export class DoctorBreakConflictError extends AppointmentError {
  constructor(message?: string, details?: Record<string, unknown>) {
    super(
      message || 'The selected appointment overlaps practitioner lunch or break period.',
      'DOCTOR_BREAK_CONFLICT',
      422,
      details,
    );
  }
}

export class DoctorScheduleClosedError extends AppointmentError {
  constructor(message?: string, details?: Record<string, unknown>) {
    super(
      message || 'The practitioner is closed or off on the requested day.',
      'DOCTOR_SCHEDULE_CLOSED',
      422,
      details,
    );
  }
}

export class AppointmentOutsideWorkingHoursError extends AppointmentError {
  constructor(message?: string, details?: Record<string, unknown>) {
    super(
      message || 'The requested appointment time is outside practitioner working hours.',
      'APPOINTMENT_OUTSIDE_WORKING_HOURS',
      422,
      details,
    );
  }
}

export class DoctorOnLeaveError extends AppointmentError {
  constructor(message?: string, details?: Record<string, unknown>) {
    super(
      message || 'The practitioner is on leave during the requested date.',
      'DOCTOR_ON_LEAVE',
      422,
      details,
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
  constructor(message?: string, details?: Record<string, unknown>) {
    super(
      message || 'The selected doctor is not active and cannot accept appointments.',
      'DOCTOR_NOT_AVAILABLE',
      422,
      details,
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

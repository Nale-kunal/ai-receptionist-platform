/**
 * Calendar Module Custom Errors
 */

export class CalendarError extends Error {
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

export class CalendarConnectionNotFoundError extends CalendarError {
  constructor(id?: string) {
    super(
      id ? `Calendar connection not found for ID: ${id}` : 'Calendar connection not found.',
      'CALENDAR_CONNECTION_NOT_FOUND',
      404,
    );
  }
}

export class CalendarIsolationViolationError extends CalendarError {
  constructor() {
    super(
      'Access denied. Cross-clinic or cross-tenant calendar isolation violation.',
      'CALENDAR_ISOLATION_VIOLATION',
      403,
    );
  }
}

export class AvailabilityFetchFailedError extends CalendarError {
  constructor(provider: string, originalError?: string) {
    super(
      `Failed to fetch availability from provider ${provider}.${originalError ? ` Error: ${originalError}` : ''}`,
      'AVAILABILITY_FETCH_FAILED',
      422,
    );
  }
}

export class WebhookVerificationFailedError extends CalendarError {
  constructor() {
    super(
      'Invalid calendar webhook signature or payload verification failed.',
      'WEBHOOK_VERIFICATION_FAILED',
      401,
    );
  }
}

export class ClinicNotActiveForCalendarError extends CalendarError {
  constructor() {
    super(
      'The selected clinic is not active.',
      'CLINIC_NOT_ACTIVE',
      422,
    );
  }
}

export class CalendarOwnershipError extends CalendarError {
  constructor(entity: string) {
    super(
      `${entity} does not belong to the specified clinic or tenant.`,
      'CALENDAR_OWNERSHIP_ERROR',
      422,
    );
  }
}

export class CalendarEncryptionKeyError extends CalendarError {
  constructor() {
    super(
      'Calendar credential encryption secret key is not configured or is invalid.',
      'ENCRYPTION_KEY_NOT_CONFIGURED',
      500,
    );
  }
}

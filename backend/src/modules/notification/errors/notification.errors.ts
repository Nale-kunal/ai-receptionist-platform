/**
 * Notification Module Custom Errors
 */

export class NotificationError extends Error {
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

export class NotificationNotFoundError extends NotificationError {
  constructor(id?: string) {
    super(
      id ? `Notification not found for ID: ${id}` : 'Notification not found.',
      'NOTIFICATION_NOT_FOUND',
      404,
    );
  }
}

export class NotificationIsolationViolationError extends NotificationError {
  constructor() {
    super(
      'Access denied. Cross-clinic or cross-tenant notification isolation violation.',
      'NOTIFICATION_ISOLATION_VIOLATION',
      403,
    );
  }
}

export class InvalidNotificationStatusTransitionError extends NotificationError {
  constructor(from: string, to: string) {
    super(
      `Invalid notification status transition from '${from}' to '${to}'.`,
      'INVALID_NOTIFICATION_STATUS_TRANSITION',
      422,
    );
  }
}

export class NotificationAlreadyTerminalError extends NotificationError {
  constructor(status: string) {
    super(
      `Notification is in terminal status '${status}' and cannot be modified.`,
      'NOTIFICATION_TERMINAL_STATUS',
      422,
    );
  }
}

export class ClinicNotActiveForNotificationError extends NotificationError {
  constructor() {
    super(
      'The selected clinic is not active.',
      'CLINIC_NOT_ACTIVE',
      422,
    );
  }
}

export class NotificationOwnershipError extends NotificationError {
  constructor(entity: string) {
    super(
      `${entity} does not belong to the specified clinic or tenant.`,
      'NOTIFICATION_OWNERSHIP_ERROR',
      422,
    );
  }
}

export class RecipientValidationFailedError extends NotificationError {
  constructor(message: string) {
    super(message, 'RECIPIENT_VALIDATION_FAILED', 422);
  }
}

export class NotificationPreferenceRestrictedError extends NotificationError {
  constructor(channel: string) {
    super(
      `Recipient has disabled ${channel} notifications.`,
      'PREFERENCE_RESTRICTED',
      422,
    );
  }
}

export class TemplateRenderError extends NotificationError {
  constructor(message: string) {
    super(message, 'TEMPLATE_RENDER_FAILED', 422);
  }
}

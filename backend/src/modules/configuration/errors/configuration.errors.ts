/**
 * Configuration Custom Errors
 *
 * Provides specific mapped exceptions for business rule violations in the
 * Configuration module.
 */

export class ConfigurationError extends Error {
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

export class ConfigurationNotFoundError extends ConfigurationError {
  constructor(id?: string) {
    super(
      id ? `Configuration not found for ID: ${id}` : 'Configuration not found.',
      'CONFIGURATION_NOT_FOUND',
      404,
    );
  }
}

export class InvalidTimezoneError extends ConfigurationError {
  constructor(timezone: string) {
    super(`Invalid timezone value: ${timezone}`, 'INVALID_TIMEZONE', 422);
  }
}

export class InvalidProviderError extends ConfigurationError {
  constructor(category: string, provider: string) {
    super(
      `Invalid provider selection for ${category}: ${provider}`,
      'INVALID_PROVIDER',
      422,
    );
  }
}

export class ConfigurationValidationFailedError extends ConfigurationError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'CONFIGURATION_VALIDATION_FAILED', 422, details);
  }
}

export class DuplicateActiveVersionError extends ConfigurationError {
  constructor() {
    super(
      'An active configuration version already exists.',
      'DUPLICATE_ACTIVE_VERSION',
      409,
    );
  }
}

export class VersionMismatchError extends ConfigurationError {
  constructor(expected: number, received: number) {
    super(
      `Configuration version mismatch. Expected: ${expected}, Received: ${received}`,
      'CONFIGURATION_VERSION_MISMATCH',
      409,
    );
  }
}

export class ConfigurationIsolationViolationError extends ConfigurationError {
  constructor() {
    super(
      'Access denied. Cross-tenant configuration request is prohibited.',
      'CONFIGURATION_ISOLATION_VIOLATION',
      403,
    );
  }
}

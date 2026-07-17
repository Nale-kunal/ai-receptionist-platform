/**
 * AI Tool Pipeline Exception Hierarchy
 */

export class AiToolError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number,
    public readonly failureClass: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = this.constructor.name;
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

export class ValidationFailure extends AiToolError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'TOOL_VALIDATION_FAILURE', 422, 'ValidationFailure', details);
  }
}

export class AuthorizationFailure extends AiToolError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'TOOL_AUTHORIZATION_FAILURE', 403, 'AuthorizationFailure', details);
  }
}

export class TenantFailure extends AiToolError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'TOOL_TENANT_ISOLATION_FAILURE', 403, 'TenantFailure', details);
  }
}

export class ToolUnavailable extends AiToolError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'TOOL_UNAVAILABLE', 503, 'ToolUnavailable', details);
  }
}

export class BusinessFailure extends AiToolError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'TOOL_BUSINESS_FAILURE', 400, 'BusinessFailure', details);
  }
}

export class InfrastructureFailure extends AiToolError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'TOOL_INFRASTRUCTURE_FAILURE', 500, 'InfrastructureFailure', details);
  }
}

export class TransientFailure extends AiToolError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'TOOL_TRANSIENT_FAILURE', 503, 'TransientFailure', details);
  }
}

export class PermanentFailure extends AiToolError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'TOOL_PERMANENT_FAILURE', 500, 'PermanentFailure', details);
  }
}

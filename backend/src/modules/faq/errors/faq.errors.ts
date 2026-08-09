/**
 * FAQ Module Custom Errors
 */

export class FaqError extends Error {
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

export class FaqNotFoundError extends FaqError {
  constructor(id?: string) {
    super(
      id ? `FAQ not found for ID: ${id}` : 'FAQ not found.',
      'FAQ_NOT_FOUND',
      404,
    );
  }
}

export class FaqIsolationViolationError extends FaqError {
  constructor() {
    super(
      'Access denied. Cross-tenant FAQ isolation violation.',
      'FAQ_ISOLATION_VIOLATION',
      403,
    );
  }
}

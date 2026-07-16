/**
 * Realtime AI Adapter Module Errors
 */

export class RealtimeAiError extends Error {
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

export class RealtimeSessionNotFoundError extends RealtimeAiError {
  constructor(sessionId: string) {
    super(
      `Realtime session '${sessionId}' was not found.`,
      'REALTIME_SESSION_NOT_FOUND',
      404,
      { sessionId },
    );
  }
}

export class RealtimeProviderUnavailableError extends RealtimeAiError {
  constructor(provider: string, reason?: string) {
    super(
      `Realtime provider '${provider}' is currently unavailable.${reason ? ` Reason: ${reason}` : ''}`,
      'REALTIME_PROVIDER_UNAVAILABLE',
      503,
      { provider, reason },
    );
  }
}

export class RealtimeInvalidStateTransitionError extends RealtimeAiError {
  constructor(from: string, to: string) {
    super(
      `Illegal realtime session state transition from '${from}' to '${to}'.`,
      'REALTIME_INVALID_STATE_TRANSITION',
      422,
      { from, to },
    );
  }
}

export class RealtimeUnauthorizedProviderError extends RealtimeAiError {
  constructor(reason: string) {
    super(
      `Realtime provider credentials validation failed: ${reason}`,
      'REALTIME_UNAUTHORIZED_PROVIDER',
      401,
      { reason },
    );
  }
}

export class RealtimeFrameOverflowError extends RealtimeAiError {
  constructor(size: number, limit: number) {
    super(
      `Realtime payload of size ${size} bytes exceeds max allowed of ${limit} bytes.`,
      'REALTIME_FRAME_OVERFLOW',
      413,
      { size, limit },
    );
  }
}

export class RealtimeProtocolValidationError extends RealtimeAiError {
  constructor(reason: string, details?: Record<string, unknown>) {
    super(
      `Realtime protocol validation failed: ${reason}`,
      'REALTIME_PROTOCOL_VALIDATION_FAILED',
      400,
      details,
    );
  }
}

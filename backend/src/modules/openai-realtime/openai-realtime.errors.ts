/**
 * OpenAI Realtime Provider — Errors
 *
 * These errors are internal to the openai-realtime module.
 * The provider normalizes them before re-throwing as generic
 * RealtimeAiError subclasses at the module boundary.
 */

// ---------------------------------------------------------------------------
// Base OpenAI Provider Error
// ---------------------------------------------------------------------------

export class OpenAiRealtimeError extends Error {
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

// ---------------------------------------------------------------------------
// Authentication & Authorization
// ---------------------------------------------------------------------------

export class OpenAiAuthenticationError extends OpenAiRealtimeError {
  constructor(reason?: string) {
    super(
      `OpenAI Realtime authentication failed.${reason ? ` Reason: ${reason}` : ''}`,
      'OPENAI_AUTHENTICATION_FAILED',
      401,
      { reason },
    );
  }
}

// ---------------------------------------------------------------------------
// Connection Lifecycle
// ---------------------------------------------------------------------------

export class OpenAiConnectionFailedError extends OpenAiRealtimeError {
  constructor(sessionId: string, reason?: string) {
    super(
      `OpenAI Realtime WebSocket connection failed for session '${sessionId}'.${reason ? ` Reason: ${reason}` : ''}`,
      'OPENAI_CONNECTION_FAILED',
      503,
      { sessionId, reason },
    );
  }
}

export class OpenAiConnectionTimeoutError extends OpenAiRealtimeError {
  constructor(sessionId: string, timeoutMs: number) {
    super(
      `OpenAI Realtime connection timed out after ${timeoutMs}ms for session '${sessionId}'.`,
      'OPENAI_CONNECTION_TIMEOUT',
      504,
      { sessionId, timeoutMs },
    );
  }
}

export class OpenAiSessionNotFoundError extends OpenAiRealtimeError {
  constructor(sessionId: string) {
    super(
      `No active OpenAI Realtime session found with id '${sessionId}'.`,
      'OPENAI_SESSION_NOT_FOUND',
      404,
      { sessionId },
    );
  }
}

export class OpenAiSessionAlreadyExistsError extends OpenAiRealtimeError {
  constructor(sessionId: string) {
    super(
      `An OpenAI Realtime session with id '${sessionId}' already exists.`,
      'OPENAI_SESSION_ALREADY_EXISTS',
      409,
      { sessionId },
    );
  }
}

// ---------------------------------------------------------------------------
// Protocol & Message Errors
// ---------------------------------------------------------------------------

export class OpenAiProtocolError extends OpenAiRealtimeError {
  constructor(reason: string, details?: Record<string, unknown>) {
    super(
      `OpenAI Realtime protocol error: ${reason}`,
      'OPENAI_PROTOCOL_ERROR',
      502,
      details,
    );
  }
}

export class OpenAiMalformedEventError extends OpenAiRealtimeError {
  constructor(eventType: string | undefined, reason: string) {
    super(
      `Malformed OpenAI Realtime event '${eventType ?? 'unknown'}': ${reason}`,
      'OPENAI_MALFORMED_EVENT',
      400,
      { eventType, reason },
    );
  }
}

// ---------------------------------------------------------------------------
// Audio Errors
// ---------------------------------------------------------------------------

export class OpenAiAudioPayloadTooLargeError extends OpenAiRealtimeError {
  constructor(actualBytes: number, maxBytes: number) {
    super(
      `Audio payload of ${actualBytes} bytes exceeds the maximum allowed size of ${maxBytes} bytes.`,
      'OPENAI_AUDIO_PAYLOAD_TOO_LARGE',
      413,
      { actualBytes, maxBytes },
    );
  }
}

export class OpenAiAudioStreamClosedError extends OpenAiRealtimeError {
  constructor(sessionId: string) {
    super(
      `Audio stream is closed for OpenAI session '${sessionId}'.`,
      'OPENAI_AUDIO_STREAM_CLOSED',
      409,
      { sessionId },
    );
  }
}

// ---------------------------------------------------------------------------
// Circuit Breaker
// ---------------------------------------------------------------------------

export class OpenAiCircuitOpenError extends OpenAiRealtimeError {
  constructor(nextAttemptAt: number) {
    super(
      `OpenAI Realtime circuit breaker is OPEN. Next retry allowed at ${new Date(nextAttemptAt).toISOString()}.`,
      'OPENAI_CIRCUIT_OPEN',
      503,
      { nextAttemptAt },
    );
  }
}

// ---------------------------------------------------------------------------
// API Error (relayed from OpenAI)
// ---------------------------------------------------------------------------

export class OpenAiApiError extends OpenAiRealtimeError {
  constructor(code: string, message: string, eventId?: string) {
    super(
      `OpenAI API error [${code}]: ${message}`,
      'OPENAI_API_ERROR',
      502,
      { apiCode: code, apiMessage: message, eventId },
    );
  }
}

// ---------------------------------------------------------------------------
// Rate Limit
// ---------------------------------------------------------------------------

export class OpenAiRateLimitError extends OpenAiRealtimeError {
  constructor(message?: string) {
    super(
      `OpenAI Realtime rate limit exceeded.${message ? ` ${message}` : ''}`,
      'OPENAI_RATE_LIMIT_EXCEEDED',
      429,
      { message },
    );
  }
}

/**
 * Voice Server Custom Errors
 */

export class VoiceServerError extends Error {
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

export class VoiceSessionNotFoundError extends VoiceServerError {
  constructor(sessionId: string) {
    super(
      `Voice session '${sessionId}' was not found.`,
      'VOICE_SESSION_NOT_FOUND',
      404,
      { sessionId },
    );
  }
}

export class VoiceProviderUnavailableError extends VoiceServerError {
  constructor(provider: string, reason?: string) {
    super(
      `Voice provider '${provider}' is currently unavailable.${reason ? ` Reason: ${reason}` : ''}`,
      'VOICE_PROVIDER_UNAVAILABLE',
      503,
      { provider, reason },
    );
  }
}

export class InvalidFrameError extends VoiceServerError {
  constructor(reason: string, details?: Record<string, unknown>) {
    super(
      `Malformed audio frame payload: ${reason}`,
      'INVALID_AUDIO_FRAME',
      400,
      details,
    );
  }
}

export class UnsupportedCodecError extends VoiceServerError {
  constructor(codec: string, supported: string[]) {
    super(
      `Audio codec '${codec}' is unsupported. Supported codecs are: ${supported.join(', ')}`,
      'UNSUPPORTED_CODEC',
      415,
      { codec, supported },
    );
  }
}

export class ConnectionClosedError extends VoiceServerError {
  constructor(reason?: string) {
    super(
      `WebSocket connection was closed prematurely.${reason ? ` Reason: ${reason}` : ''}`,
      'CONNECTION_CLOSED',
      499,
      { reason },
    );
  }
}

export class HeartbeatTimeoutError extends VoiceServerError {
  constructor() {
    super(
      'Session connection lost due to heartbeat timeout (ping/pong failure).',
      'HEARTBEAT_TIMEOUT',
      408,
    );
  }
}

export class InvalidStateTransitionError extends VoiceServerError {
  constructor(from: string, to: string) {
    super(
      `Illegal session state transition from '${from}' to '${to}'.`,
      'INVALID_STATE_TRANSITION',
      422,
      { from, to },
    );
  }
}

export class UnauthorizedProviderError extends VoiceServerError {
  constructor(reason: string) {
    super(
      `Provider credentials or request signature validation failed: ${reason}`,
      'UNAUTHORIZED_PROVIDER',
      401,
      { reason },
    );
  }
}

export class StreamOverflowError extends VoiceServerError {
  constructor(queueSize: number, maxSize: number) {
    super(
      `Audio pipeline buffer overflow. Current queue size is ${queueSize}, max is ${maxSize}.`,
      'STREAM_OVERFLOW',
      429,
      { queueSize, maxSize },
    );
  }
}

export class BackpressureExceededError extends VoiceServerError {
  constructor(message?: string) {
    super(
      message || 'Data flow rate limits exceeded; backpressure safety checks blocked execution.',
      'BACKPRESSURE_EXCEEDED',
      429,
    );
  }
}

/**
 * End-to-End Call Flow — Custom Errors
 */

export class E2eCallError extends Error {
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

export class E2eCallSessionNotFoundError extends E2eCallError {
  constructor(sessionId: string) {
    super(`E2E Call session '${sessionId}' was not found.`, 'E2E_SESSION_NOT_FOUND', 404, { sessionId });
  }
}

export class E2eInvalidStateTransitionError extends E2eCallError {
  constructor(from: string, to: string) {
    super(`Illegal state transition from '${from}' to '${to}'.`, 'E2E_INVALID_STATE_TRANSITION', 422, { from, to });
  }
}

export class E2eTimeoutError extends E2eCallError {
  constructor(type: string, limitMs: number) {
    super(`Call flow operation '${type}' timed out after ${limitMs}ms.`, 'E2E_TIMEOUT_ERROR', 408, { type, limitMs });
  }
}

export class E2eProviderDisconnectionError extends E2eCallError {
  constructor(provider: string, reason?: string) {
    super(`Telephony provider '${provider}' disconnected.${reason ? ` Reason: ${reason}` : ''}`, 'E2E_PROVIDER_DISCONNECT', 503, { provider, reason });
  }
}

export class E2eSecurityValidationError extends E2eCallError {
  constructor(reason: string) {
    super(`Security validation failure: ${reason}`, 'E2E_SECURITY_VIOLATION', 403, { reason });
  }
}

export class E2eToolExecutionError extends E2eCallError {
  constructor(toolId: string, reason: string) {
    super(`AI tool execution failed for '${toolId}': ${reason}`, 'E2E_TOOL_EXECUTION_FAILURE', 500, { toolId, reason });
  }
}

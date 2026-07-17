/**
 * Conversation Orchestrator Custom Errors and Failure Classes
 */

export class ConversationOrchestratorError extends Error {
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

export class OrchestratorInvalidStateTransitionError extends ConversationOrchestratorError {
  constructor(from: string, to: string) {
    super(
      `Illegal orchestration state transition from '${from}' to '${to}'.`,
      'ORCHESTRATOR_INVALID_STATE_TRANSITION',
      422,
      { from, to }
    );
  }
}

export class TurnConflictError extends ConversationOrchestratorError {
  constructor(reason: string) {
    super(
      `Turn manager conflict: ${reason}`,
      'TURN_CONFLICT',
      409,
      { reason }
    );
  }
}

export class OrchestratorTimeoutError extends ConversationOrchestratorError {
  constructor(timeoutType: string, limitMs: number) {
    super(
      `Orchestrator timeout triggered. Type: ${timeoutType} (${limitMs}ms threshold).`,
      'ORCHESTRATOR_TIMEOUT',
      408,
      { timeoutType, limitMs }
    );
  }
}

export class ConversationNotFoundError extends ConversationOrchestratorError {
  constructor(sessionId: string) {
    super(
      `Active orchestration session '${sessionId}' was not found.`,
      'CONVERSATION_NOT_FOUND',
      404,
      { sessionId }
    );
  }
}

// ---------------------------------------------------------------------------
// Failure Class Hierarchy (Enterprise resilience classification)
// ---------------------------------------------------------------------------

export class TransientFailure extends ConversationOrchestratorError {
  constructor(message: string, code = 'TRANSIENT_FAILURE', details?: Record<string, unknown>) {
    super(message, code, 503, details);
  }
}

export class PermanentFailure extends ConversationOrchestratorError {
  constructor(message: string, code = 'PERMANENT_FAILURE', details?: Record<string, unknown>) {
    super(message, code, 500, details);
  }
}

export class ProviderFailure extends TransientFailure {
  constructor(provider: string, reason: string, details?: Record<string, unknown>) {
    super(`Provider '${provider}' failure: ${reason}`, 'PROVIDER_FAILURE', { ...details, provider, reason });
  }
}

export class AIFailure extends TransientFailure {
  constructor(reason: string, details?: Record<string, unknown>) {
    super(`AI Engine/LLM failure: ${reason}`, 'AI_FAILURE', { ...details, reason });
  }
}

export class InfrastructureFailure extends TransientFailure {
  constructor(reason: string, details?: Record<string, unknown>) {
    super(`Infrastructure service failure: ${reason}`, 'INFRASTRUCTURE_FAILURE', { ...details, reason });
  }
}

export class BusinessFailure extends PermanentFailure {
  constructor(reason: string, details?: Record<string, unknown>) {
    super(`Business constraint violation: ${reason}`, 'BUSINESS_FAILURE', { ...details, reason });
  }
}

/**
 * Conversation Orchestrator Custom Errors
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
      { from, to },
    );
  }
}

export class TurnConflictError extends ConversationOrchestratorError {
  constructor(reason: string) {
    super(
      `Turn manager conflict: ${reason}`,
      'TURN_CONFLICT',
      409,
      { reason },
    );
  }
}

export class OrchestratorTimeoutError extends ConversationOrchestratorError {
  constructor(timeoutType: string, limitMs: number) {
    super(
      `Conversation session timed out. Type: ${timeoutType} (${limitMs}ms threshold).`,
      'ORCHESTRATOR_TIMEOUT',
      408,
      { timeoutType, limitMs },
    );
  }
}

export class ConversationNotFoundError extends ConversationOrchestratorError {
  constructor(sessionId: string) {
    super(
      `Active conversation orchestration session '${sessionId}' was not found.`,
      'CONVERSATION_NOT_FOUND',
      404,
      { sessionId },
    );
  }
}

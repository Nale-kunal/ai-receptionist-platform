/**
 * Conversation Module Custom Errors
 */

export class ConversationError extends Error {
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

export class ConversationNotFoundError extends ConversationError {
  constructor(id?: string) {
    super(
      id ? `Conversation not found for ID: ${id}` : 'Conversation not found.',
      'CONVERSATION_NOT_FOUND',
      404,
    );
  }
}

export class ConversationIsolationViolationError extends ConversationError {
  constructor() {
    super(
      'Access denied. Cross-clinic or cross-tenant conversation isolation violation.',
      'CONVERSATION_ISOLATION_VIOLATION',
      403,
    );
  }
}

export class InvalidConversationStatusTransitionError extends ConversationError {
  constructor(from: string, to: string) {
    super(
      `Invalid conversation status transition from '${from}' to '${to}'.`,
      'INVALID_CONVERSATION_STATUS_TRANSITION',
      422,
    );
  }
}

export class ConversationAlreadyTerminalError extends ConversationError {
  constructor(status: string) {
    super(
      `Conversation is in terminal status '${status}' and cannot be modified.`,
      'CONVERSATION_TERMINAL_STATUS',
      422,
    );
  }
}

export class ConversationTranscriptImmutableError extends ConversationError {
  constructor() {
    super(
      'Transcript is immutable after conversation completion.',
      'TRANSCRIPT_IMMUTABLE',
      422,
    );
  }
}

export class ClinicNotActiveForConversationError extends ConversationError {
  constructor() {
    super(
      'The selected clinic is not active.',
      'CLINIC_NOT_ACTIVE',
      422,
    );
  }
}

export class ConversationOwnershipError extends ConversationError {
  constructor(entity: string) {
    super(
      `${entity} does not belong to the specified clinic or tenant.`,
      'CONVERSATION_OWNERSHIP_ERROR',
      422,
    );
  }
}

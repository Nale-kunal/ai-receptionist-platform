/**
 * Prompt Engine Custom Error Hierarchy
 */

export class PromptEngineError extends Error {
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

export class PromptNotFoundError extends PromptEngineError {
  constructor(id?: string) {
    super(
      id ? `Prompt '${id}' was not found.` : 'Prompt was not found.',
      'PROMPT_NOT_FOUND',
      404,
    );
  }
}

export class PromptIsolationViolationError extends PromptEngineError {
  constructor() {
    super(
      'Tenant boundary violation: prompt does not belong to this tenant.',
      'PROMPT_ISOLATION_VIOLATION',
      403,
    );
  }
}

export class PromptValidationFailedError extends PromptEngineError {
  constructor(errors: Array<{ code: string; message: string; variable?: string }>) {
    super(
      'Prompt validation failed. Fix all errors before publishing.',
      'PROMPT_VALIDATION_FAILED',
      422,
      { errors },
    );
  }
}

export class PromptVariableError extends PromptEngineError {
  constructor(variable: string, reason: string) {
    super(
      `Invalid prompt variable '${variable}': ${reason}`,
      'PROMPT_VARIABLE_ERROR',
      422,
      { variable, reason },
    );
  }
}

export class PromptAlreadyPublishedError extends PromptEngineError {
  constructor() {
    super(
      'This prompt version is already published. Create a new version to make changes.',
      'PROMPT_ALREADY_PUBLISHED',
      409,
    );
  }
}

export class PromptNotPublishableError extends PromptEngineError {
  constructor(status: string) {
    super(
      `Prompt with status '${status}' cannot be published. Only draft prompts may be published.`,
      'PROMPT_NOT_PUBLISHABLE',
      422,
      { status },
    );
  }
}

export class PromptNotArchivableError extends PromptEngineError {
  constructor(status: string) {
    super(
      `Prompt with status '${status}' cannot be archived.`,
      'PROMPT_NOT_ARCHIVABLE',
      422,
      { status },
    );
  }
}

export class PromptContentTooLargeError extends PromptEngineError {
  constructor(length: number, maxLength: number) {
    super(
      `Prompt content exceeds maximum length. Got ${length} characters, maximum is ${maxLength}.`,
      'PROMPT_CONTENT_TOO_LARGE',
      422,
      { length, maxLength },
    );
  }
}

export class PromptSecretLeakError extends PromptEngineError {
  constructor() {
    super(
      'Prompt content contains a pattern that looks like a secret or credential. Prompts must never contain secrets.',
      'PROMPT_SECRET_LEAK_DETECTED',
      422,
    );
  }
}

export class PromptRollbackError extends PromptEngineError {
  constructor(reason: string) {
    super(
      `Rollback failed: ${reason}`,
      'PROMPT_ROLLBACK_FAILED',
      422,
    );
  }
}

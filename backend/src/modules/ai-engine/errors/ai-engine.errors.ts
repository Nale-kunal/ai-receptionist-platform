/**
 * AI Engine Module Custom Errors
 */

export class AiEngineError extends Error {
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

export class AiProviderUnavailableError extends AiEngineError {
  constructor(provider: string, message?: string) {
    super(
      message || `AI Provider '${provider}' is currently unavailable.`,
      'AI_PROVIDER_UNAVAILABLE',
      503,
    );
  }
}

export class PromptInjectionDetectedError extends AiEngineError {
  constructor(message?: string) {
    super(
      message || 'Security validation failed: prompt injection detected.',
      'PROMPT_INJECTION_DETECTED',
      400,
    );
  }
}

export class LowConfidenceError extends AiEngineError {
  constructor(intent: string, score: number, threshold: number) {
    super(
      `AI confidence score for intent '${intent}' is ${score.toFixed(2)}, which is below the threshold of ${threshold.toFixed(2)}.`,
      'LOW_CONFIDENCE',
      422,
      { intent, score, threshold },
    );
  }
}

export class MalformedToolRequestError extends AiEngineError {
  constructor(toolName: string, message: string) {
    super(
      `AI generated a malformed tool request for '${toolName}': ${message}`,
      'MALFORMED_TOOL_REQUEST',
      422,
      { toolName },
    );
  }
}

export class AiEngineIsolationError extends AiEngineError {
  constructor(message?: string) {
    super(
      message || 'Tenant boundary violation detected.',
      'AI_ENGINE_ISOLATION_VIOLATION',
      403,
    );
  }
}

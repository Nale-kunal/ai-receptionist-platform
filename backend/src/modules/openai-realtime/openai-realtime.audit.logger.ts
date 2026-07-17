/**
 * OpenAI Realtime Provider — Audit Logger
 *
 * Writes sanitized, PHI-free audit entries for all provider lifecycle events.
 * Uses console logging as the output sink (the platform's audit database
 * writes are handled by the adapter layer's RealtimeAuditLogger).
 * This logger handles provider-specific events not tracked by the adapter.
 */

import type { IOpenAiAuditLogger } from './openai-realtime.interfaces';
import { redactApiKey } from './openai-realtime.validators';

// ---------------------------------------------------------------------------
// Structured Log Entry Shape
// ---------------------------------------------------------------------------

interface AuditEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  provider: 'openai-realtime';
  event: string;
  sessionId: string;
  data: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Audit Logger Implementation
// ---------------------------------------------------------------------------

export class OpenAiRealtimeAuditLogger implements IOpenAiAuditLogger {
  private readonly sink: (entry: AuditEntry) => void;

  constructor(sink?: (entry: AuditEntry) => void) {
    // Default: structured JSON to stdout
    this.sink = sink ?? ((entry) => {
      console.log(JSON.stringify(entry));
    });
  }

  public async logConnectionEstablished(sessionId: string, model: string): Promise<void> {
    this.write('info', 'openai.connection.established', sessionId, { model });
  }

  public async logConnectionClosed(sessionId: string, reason: string): Promise<void> {
    this.write('info', 'openai.connection.closed', sessionId, { reason });
  }

  public async logReconnectAttempt(
    sessionId: string,
    attempt: number,
    maxAttempts: number,
  ): Promise<void> {
    this.write('warn', 'openai.reconnect.attempt', sessionId, { attempt, maxAttempts });
  }

  public async logApiError(
    sessionId: string,
    code: string,
    message: string,
  ): Promise<void> {
    // Sanitize: never log raw message content — it may contain PHI
    this.write('error', 'openai.api.error', sessionId, {
      code,
      message: this.sanitizeErrorMessage(message),
    });
  }

  public async logToolCallReceived(
    sessionId: string,
    callId: string,
    name: string,
  ): Promise<void> {
    this.write('info', 'openai.tool_call.received', sessionId, { callId, toolName: name });
  }

  public async logTokenUsage(
    sessionId: string,
    inputTokens: number,
    outputTokens: number,
  ): Promise<void> {
    this.write('info', 'openai.token.usage', sessionId, {
      inputTokens,
      outputTokens,
      totalTokens: inputTokens + outputTokens,
    });
  }

  public async logCircuitBreakerOpened(sessionId: string): Promise<void> {
    this.write('warn', 'openai.circuit_breaker.opened', sessionId, {});
  }

  public async logCircuitBreakerClosed(sessionId: string): Promise<void> {
    this.write('info', 'openai.circuit_breaker.closed', sessionId, {});
  }

  // ---------------------------------------------------------------------------
  // Internal
  // ---------------------------------------------------------------------------

  private write(
    level: AuditEntry['level'],
    event: string,
    sessionId: string,
    data: Record<string, unknown>,
  ): void {
    const entry: AuditEntry = {
      timestamp: new Date().toISOString(),
      level,
      provider: 'openai-realtime',
      event,
      sessionId,
      data,
    };
    this.sink(entry);
  }

  private sanitizeErrorMessage(message: string): string {
    // Redact patterns that may contain PHI or secrets
    return message
      .replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[SSN_REDACTED]')          // SSN pattern
      .replace(/\b\d{10,}\b/g, '[NUM_REDACTED]')                      // Long numbers
      .replace(/sk-[a-zA-Z0-9]+/g, '[API_KEY_REDACTED]')              // OpenAI API keys
      .replace(/Bearer [a-zA-Z0-9._-]+/g, 'Bearer [TOKEN_REDACTED]'); // Bearer tokens
  }
}

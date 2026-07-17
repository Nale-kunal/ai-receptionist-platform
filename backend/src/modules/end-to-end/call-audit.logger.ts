/**
 * End-to-End Call Flow — Audit Logger
 *
 * Implements strict PHI filtering and caller phone number masking.
 */

import type { ICallAuditLogger } from './end-to-end.interfaces';
import type { E2eCallState } from './end-to-end.constants';

export interface E2eAuditLogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  module: 'end-to-end';
  event: string;
  sessionId: string;
  data: Record<string, unknown>;
}

export class CallAuditLogger implements ICallAuditLogger {
  private readonly sink: (entry: E2eAuditLogEntry) => void;

  constructor(sink?: (entry: E2eAuditLogEntry) => void) {
    this.sink = sink ?? ((entry) => {
      console.log(JSON.stringify(entry));
    });
  }

  public logStateTransition(sessionId: string, from: E2eCallState, to: E2eCallState): void {
    this.write('info', 'e2e.state.transition', sessionId, { from, to });
  }

  public logGreetingStarted(sessionId: string): void {
    this.write('info', 'e2e.greeting.started', sessionId, {});
  }

  public logToolRequest(sessionId: string, toolId: string, parameters: Record<string, unknown>): void {
    this.write('info', 'e2e.tool.request', sessionId, {
      toolId,
      parameters: this.sanitizeParameters(parameters),
    });
  }

  public logInterruptionDetected(sessionId: string): void {
    this.write('info', 'e2e.interruption.detected', sessionId, {});
  }

  public logReconnectAttempt(sessionId: string, attempt: number): void {
    this.write('warn', 'e2e.reconnect.attempt', sessionId, { attempt });
  }

  public logTimeoutTriggered(sessionId: string, type: string): void {
    this.write('warn', 'e2e.timeout.triggered', sessionId, { type });
  }

  public logError(sessionId: string, code: string, message: string): void {
    this.write('error', 'e2e.error.occurred', sessionId, {
      code,
      message: this.sanitizeMessage(message),
    });
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private write(
    level: E2eAuditLogEntry['level'],
    event: string,
    sessionId: string,
    data: Record<string, unknown>,
  ): void {
    this.sink({
      timestamp: new Date().toISOString(),
      level,
      module: 'end-to-end',
      event,
      sessionId,
      data,
    });
  }

  private sanitizeParameters(params: Record<string, unknown>): Record<string, unknown> {
    const copy = { ...params };
    const sensitiveKeys = ['phone', 'phoneNumber', 'ssn', 'patientName', 'email', 'dob'];
    for (const key of Object.keys(copy)) {
      if (sensitiveKeys.includes(key) && typeof copy[key] === 'string') {
        copy[key] = this.maskSensitive(copy[key] as string);
      }
    }
    return copy;
  }

  private maskSensitive(val: string): string {
    if (val.length <= 4) return '****';
    return `${val.slice(0, 2)}****${val.slice(-2)}`;
  }

  private sanitizeMessage(msg: string): string {
    return msg
      .replace(/ey[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g, '[JWT_REDACTED]') // JWTs
      .replace(/sk-[a-zA-Z0-9]{32,}/g, '[API_KEY_REDACTED]')                          // OpenAI keys
      .replace(/AC[a-zA-Z0-9]{32}/g, '[TWILIO_ACCOUNT_REDACTED]');                      // Twilio Account SIDs
  }
}
export const callAuditLogger = new CallAuditLogger();

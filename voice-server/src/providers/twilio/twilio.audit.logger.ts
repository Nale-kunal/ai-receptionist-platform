/**
 * Twilio Voice Provider — Audit Logger
 *
 * Masks caller numbers and filters secrets before printing.
 */

export interface TwilioAuditEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  provider: 'twilio';
  event: string;
  sessionId: string;
  data: Record<string, unknown>;
}

export class TwilioAuditLogger {
  private readonly sink: (entry: TwilioAuditEntry) => void;

  constructor(sink?: (entry: TwilioAuditEntry) => void) {
    this.sink = sink ?? ((entry) => {
      console.log(JSON.stringify(entry));
    });
  }

  public logCallCreated(sessionId: string, callSid: string, from: string, to: string): void {
    this.write('info', 'twilio.call.created', sessionId, {
      callSid,
      from: this.maskPhoneNumber(from),
      to: this.maskPhoneNumber(to),
    });
  }

  public logCallConnected(sessionId: string): void {
    this.write('info', 'twilio.call.connected', sessionId, {});
  }

  public logCallEnded(sessionId: string, durationMs: number): void {
    this.write('info', 'twilio.call.ended', sessionId, { durationMs });
  }

  public logWebhookFailure(url: string, error: string): void {
    this.write('error', 'twilio.webhook.failure', 'system', {
      url,
      error: this.sanitizeMessage(error),
    });
  }

  public logMediaStreamFailure(sessionId: string, error: string): void {
    this.write('error', 'twilio.media_stream.failure', sessionId, {
      error: this.sanitizeMessage(error),
    });
  }

  public logCircuitBreakerOpened(provider: string): void {
    this.write('warn', 'twilio.circuit_breaker.opened', 'system', { provider });
  }

  public logCircuitBreakerClosed(provider: string): void {
    this.write('info', 'twilio.circuit_breaker.closed', 'system', { provider });
  }

  // ---------------------------------------------------------------------------
  // Helper functions
  // ---------------------------------------------------------------------------

  private write(
    level: TwilioAuditEntry['level'],
    event: string,
    sessionId: string,
    data: Record<string, unknown>,
  ): void {
    this.sink({
      timestamp: new Date().toISOString(),
      level,
      provider: 'twilio',
      event,
      sessionId,
      data,
    });
  }

  public maskPhoneNumber(phone: string): string {
    if (!phone) return '[EMPTY]';
    // Keep first 3 chars and last 2 chars
    if (phone.length <= 5) return '*****';
    return `${phone.slice(0, 3)}*****${phone.slice(-2)}`;
  }

  private sanitizeMessage(msg: string): string {
    return msg
      .replace(/AC[a-zA-Z0-9]{32}/g, 'AC********************************') // Twilio Account SIDs
      .replace(/auth_token=[a-zA-Z0-9]+/gi, 'auth_token=[REDACTED]')       // Inline Auth Tokens
      .replace(/bearer [a-zA-Z0-9._-]+/gi, 'Bearer [TOKEN_REDACTED]');      // Bearer tokens
  }
}

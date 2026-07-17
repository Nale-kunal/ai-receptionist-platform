/**
 * End-to-End Call Flow — Reconnect Retry Manager
 */

import { E2E_RECONNECT_RETRY_ATTEMPTS, E2E_RECONNECT_BACKOFF_BASE_MS } from './end-to-end.constants';

export class CallRetryManager {
  private readonly attempts = new Map<string, number>();

  public getAttempts(sessionId: string): number {
    return this.attempts.get(sessionId) ?? 0;
  }

  public incrementAttempts(sessionId: string): number {
    const next = this.getAttempts(sessionId) + 1;
    this.attempts.set(sessionId, next);
    return next;
  }

  public shouldRetry(sessionId: string): boolean {
    return this.getAttempts(sessionId) < E2E_RECONNECT_RETRY_ATTEMPTS;
  }

  public getBackoffDelayMs(sessionId: string): number {
    const attempt = this.getAttempts(sessionId);
    // Exponential backoff: base * 2^attempt
    return E2E_RECONNECT_BACKOFF_BASE_MS * Math.pow(2, attempt);
  }

  public reset(sessionId: string): void {
    this.attempts.delete(sessionId);
  }
}
export const callRetryManager = new CallRetryManager();

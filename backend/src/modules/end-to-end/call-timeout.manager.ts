/**
 * End-to-End Call Flow — Timeout Manager
 */

import type { ICallTimeoutManager } from './end-to-end.interfaces';

export class CallTimeoutManager implements ICallTimeoutManager {
  // sessionId -> timerType -> NodeJS.Timeout
  private readonly timers = new Map<string, Map<string, NodeJS.Timeout>>();

  public registerTimeout(
    sessionId: string,
    type: 'inactivity' | 'ai' | 'tool' | 'max_duration',
    timeoutMs: number,
    callback: () => void,
  ): void {
    let sessionTimers = this.timers.get(sessionId);
    if (!sessionTimers) {
      sessionTimers = new Map<string, NodeJS.Timeout>();
      this.timers.set(sessionId, sessionTimers);
    }

    // Clear existing timer if registered
    const existing = sessionTimers.get(type);
    if (existing) {
      clearTimeout(existing);
    }

    const timer = setTimeout(() => {
      this.clearTimeout(sessionId, type);
      callback();
    }, timeoutMs);

    sessionTimers.set(type, timer);
  }

  public clearTimeout(sessionId: string, type: 'inactivity' | 'ai' | 'tool' | 'max_duration'): void {
    const sessionTimers = this.timers.get(sessionId);
    if (sessionTimers) {
      const timer = sessionTimers.get(type);
      if (timer) {
        clearTimeout(timer);
        sessionTimers.delete(type);
      }
    }
  }

  public clearAll(sessionId: string): void {
    const sessionTimers = this.timers.get(sessionId);
    if (sessionTimers) {
      for (const timer of sessionTimers.values()) {
        clearTimeout(timer);
      }
      this.timers.delete(sessionId);
    }
  }
}
export const callTimeoutManager = new CallTimeoutManager();

import type { IRuntimeResourceManager } from './conversation-orchestrator.interfaces';

export class RuntimeResourceManager implements IRuntimeResourceManager {
  private readonly sessionTimers: Map<string, Map<string, NodeJS.Timeout>> = new Map();
  private readonly sessionListeners: Map<
    string,
    Array<{ emitter: any; event: string; handler: (...args: any[]) => void }>
  > = new Map();

  public registerTimer(sessionId: string, key: string, timer: NodeJS.Timeout): void {
    let timers = this.sessionTimers.get(sessionId);
    if (!timers) {
      timers = new Map();
      this.sessionTimers.set(sessionId, timers);
    }
    const old = timers.get(key);
    if (old) {
      clearTimeout(old);
    }
    timers.set(key, timer);
  }

  public registerListener(
    sessionId: string,
    emitter: any,
    event: string,
    handler: (...args: any[]) => void
  ): void {
    const list = this.sessionListeners.get(sessionId) ?? [];
    emitter.on(event, handler);
    list.push({ emitter, event, handler });
    this.sessionListeners.set(sessionId, list);
  }

  public clearSessionResources(sessionId: string): void {
    // Clear and delete timers
    const timers = this.sessionTimers.get(sessionId);
    if (timers) {
      for (const t of timers.values()) {
        clearTimeout(t);
      }
      this.sessionTimers.delete(sessionId);
    }

    // Unsubscribe event listeners
    const list = this.sessionListeners.get(sessionId);
    if (list) {
      for (const item of list) {
        try {
          item.emitter.off(item.event, item.handler);
        } catch {
          // Safe check
        }
      }
      this.sessionListeners.delete(sessionId);
    }
  }
}

/**
 * End-to-End Call Flow — Health Monitor
 */

import type { ICallHealthMonitor } from './end-to-end.interfaces';
import { CallSessionManager } from './call-session.manager';

export class CallHealthMonitor implements ICallHealthMonitor {
  private readonly heartbeats = new Map<string, number>();

  constructor(private readonly sessionManager: CallSessionManager) {}

  public trackHeartbeat(sessionId: string): void {
    this.heartbeats.set(sessionId, Date.now());
  }

  public checkHealth(): { stuckSessionsCount: number; orphanSessionsCount: number } {
    const now = Date.now();
    let stuckSessionsCount = 0;
    let orphanSessionsCount = 0;

    const sessions = this.sessionManager.activeSessions();

    for (const session of sessions) {
      // 1. Stuck check: Active call in PROCESSING state for > 5 minutes
      if (session.currentState === 'PROCESSING' && now - session.updatedAt > 300000) {
        stuckSessionsCount += 1;
      }

      // 2. Orphan check: Missing voice or realtime session link after 1 minute of creation
      if (
        (session.voiceSessionId === null || session.realtimeSessionId === null) &&
        now - session.createdAt > 60000
      ) {
        orphanSessionsCount += 1;
      }
    }

    return { stuckSessionsCount, orphanSessionsCount };
  }

  public remove(sessionId: string): void {
    this.heartbeats.delete(sessionId);
  }
}

/**
 * End-to-End Call Flow — Session Manager
 */

import type { ICallSessionManager } from './end-to-end.interfaces';
import type { E2eCallSession, E2eCallContext } from './end-to-end.types';
import type { E2eCallState } from './end-to-end.constants';

export class CallSessionManager implements ICallSessionManager {
  private readonly sessions = new Map<string, E2eCallSession>();
  private readonly callSidToSessionId = new Map<string, string>();

  public createSession(
    sessionId: string,
    callSid: string,
    context: E2eCallContext,
  ): E2eCallSession {
    const now = Date.now();
    const session: E2eCallSession = {
      sessionId,
      callSid,
      voiceSessionId: null,
      realtimeSessionId: null,
      currentState: 'INCOMING_CALL',
      context,
      createdAt: now,
      updatedAt: now,
    };

    this.sessions.set(sessionId, session);
    this.callSidToSessionId.set(callSid, sessionId);
    return session;
  }

  public getSession(sessionId: string): E2eCallSession | undefined {
    return this.sessions.get(sessionId);
  }

  public getSessionByCallSid(callSid: string): E2eCallSession | undefined {
    const sessionId = this.callSidToSessionId.get(callSid);
    if (!sessionId) return undefined;
    return this.sessions.get(sessionId);
  }

  public updateState(sessionId: string, state: E2eCallState): E2eCallSession {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session '${sessionId}' not found.`);
    }

    session.currentState = state;
    session.updatedAt = Date.now();
    
    if (state === 'CALL_COMPLETED' || state === 'TERMINATED') {
      session.context.endTime = Date.now();
    }

    return session;
  }

  public removeSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      this.callSidToSessionId.delete(session.callSid);
      this.sessions.delete(sessionId);
    }
  }

  public activeSessions(): E2eCallSession[] {
    return Array.from(this.sessions.values());
  }

  public clear(): void {
    this.sessions.clear();
    this.callSidToSessionId.clear();
  }
}
export const callSessionManager = new CallSessionManager();

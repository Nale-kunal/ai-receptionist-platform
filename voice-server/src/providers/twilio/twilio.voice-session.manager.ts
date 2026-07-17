/**
 * Twilio Voice Provider — Voice Session Manager
 *
 * Tracks active call session links between Twilio Call SIDs and session IDs.
 */

import type { TwilioCallSession } from './twilio.types';
import type { TwilioCallState } from './twilio.constants';
import { TWILIO_CALL_STATE_CREATED } from './twilio.constants';
import { CallLifecycleFailure } from './twilio.errors';

export class TwilioVoiceSessionManager {
  private readonly sessions = new Map<string, TwilioCallSession>();
  private readonly callSidToSessionId = new Map<string, string>();

  public createSession(
    sessionId: string,
    callSid: string,
    tenantId: string,
    clinicId: string | null,
    metadata: Record<string, unknown> = {},
  ): TwilioCallSession {
    if (this.sessions.has(sessionId)) {
      throw new CallLifecycleFailure(`Session ID '${sessionId}' already exists.`);
    }
    if (this.callSidToSessionId.has(callSid)) {
      throw new CallLifecycleFailure(`Call SID '${callSid}' is already registered.`);
    }

    const now = Date.now();
    const session: TwilioCallSession = {
      sessionId,
      callSid,
      tenantId,
      clinicId,
      state: TWILIO_CALL_STATE_CREATED,
      createdAt: now,
      updatedAt: now,
      endedAt: null,
      metadata,
    };

    this.sessions.set(sessionId, session);
    this.callSidToSessionId.set(callSid, sessionId);
    return session;
  }

  public getSession(sessionId: string): TwilioCallSession | undefined {
    return this.sessions.get(sessionId);
  }

  public getSessionByCallSid(callSid: string): TwilioCallSession | undefined {
    const sessionId = this.callSidToSessionId.get(callSid);
    if (!sessionId) return undefined;
    return this.sessions.get(sessionId);
  }

  public updateState(sessionId: string, state: TwilioCallState): TwilioCallSession {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new CallLifecycleFailure(`Session '${sessionId}' not found.`);
    }

    session.state = state;
    session.updatedAt = Date.now();
    if (state === 'ENDED' || state === 'FAILED') {
      session.endedAt = Date.now();
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

  public activeCount(): number {
    return this.sessions.size;
  }

  public clear(): void {
    this.sessions.clear();
    this.callSidToSessionId.clear();
  }
}

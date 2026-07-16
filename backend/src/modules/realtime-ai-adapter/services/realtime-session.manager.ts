import type { IRealtimeSessionManager } from '../interfaces/realtime-ai.interfaces';
import type { SafeRealtimeSession } from '../types/realtime-ai.types';
import type { RealtimeProviderType, RealtimeSessionState } from '../constants/realtime-ai.constants';
import { RealtimeSessionModel } from './realtime-session.model';
import { RealtimeSessionStateMachine } from './realtime-session.state-machine';
import { RealtimeSessionNotFoundError } from '../errors/realtime-ai.errors';

export class RealtimeSessionManager implements IRealtimeSessionManager {
  private readonly sessions: Map<string, RealtimeSessionModel> = new Map();
  private readonly creationTimestamps: Map<string, number[]> = new Map();

  constructor(
    private readonly config: { rateLimitSessionsPerMinute: number }
  ) {}

  public async createSession(params: {
    tenantId: string;
    clinicId: string | null;
    conversationId: string;
    provider: RealtimeProviderType;
    providerSessionId: string;
    metadata?: Record<string, unknown>;
  }): Promise<SafeRealtimeSession> {
    const id = this.generateUuid();
    const publicId = `rt_ses_${this.generateRandomString(12)}`;

    const session = new RealtimeSessionModel({
      id,
      publicId,
      tenantId: params.tenantId,
      clinicId: params.clinicId,
      conversationId: params.conversationId,
      provider: params.provider,
      providerSessionId: params.providerSessionId,
      metadata: params.metadata ?? {},
    });

    this.sessions.set(publicId, session);

    // Track creation timestamp
    const now = Date.now();
    const list = this.creationTimestamps.get(params.tenantId) ?? [];
    list.push(now);
    this.creationTimestamps.set(params.tenantId, list);

    return session.toSafeSession();
  }

  public async getSession(sessionId: string, tenantId: string): Promise<SafeRealtimeSession> {
    const session = this.sessions.get(sessionId);
    if (!session || session.tenantId !== tenantId) {
      throw new RealtimeSessionNotFoundError(sessionId);
    }
    return session.toSafeSession();
  }

  public async updateSessionState(
    sessionId: string,
    tenantId: string,
    state: RealtimeSessionState
  ): Promise<SafeRealtimeSession> {
    const session = this.sessions.get(sessionId);
    if (!session || session.tenantId !== tenantId) {
      throw new RealtimeSessionNotFoundError(sessionId);
    }

    RealtimeSessionStateMachine.validateTransition(session.connectionState, state);

    const updated = session.copyWith({
      connectionState: state,
      endedAt: RealtimeSessionStateMachine.isTerminal(state) ? new Date() : session.endedAt,
    });

    this.sessions.set(sessionId, updated);
    return updated.toSafeSession();
  }

  public async endSession(
    sessionId: string,
    tenantId: string,
    error?: { code: string; message: string }
  ): Promise<SafeRealtimeSession> {
    const session = this.sessions.get(sessionId);
    if (!session || session.tenantId !== tenantId) {
      throw new RealtimeSessionNotFoundError(sessionId);
    }

    const targetState = error ? 'FAILED' : 'ENDED';
    RealtimeSessionStateMachine.validateTransition(session.connectionState, targetState);

    const updated = session.copyWith({
      connectionState: targetState,
      endedAt: new Date(),
      metadata: error ? { ...session.metadata, lastError: error } : session.metadata,
    });

    this.sessions.set(sessionId, updated);
    return updated.toSafeSession();
  }

  public async listActiveSessions(tenantId: string): Promise<SafeRealtimeSession[]> {
    const list: SafeRealtimeSession[] = [];
    for (const session of this.sessions.values()) {
      if (session.tenantId === tenantId && !RealtimeSessionStateMachine.isTerminal(session.connectionState)) {
        list.push(session.toSafeSession());
      }
    }
    return list;
  }

  public rateLimitCheck(tenantId: string): boolean {
    const now = Date.now();
    const timestamps = this.creationTimestamps.get(tenantId) ?? [];
    
    const active = timestamps.filter((t) => now - t < 60000);
    this.creationTimestamps.set(tenantId, active);

    return active.length < this.config.rateLimitSessionsPerMinute;
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private generateUuid(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  private generateRandomString(length: number): string {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }
}

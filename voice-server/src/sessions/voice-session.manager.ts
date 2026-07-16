import type { IVoiceSessionManager } from '../interfaces/voice-server.interfaces';
import type { SafeVoiceSession, VoiceSessionState, VoiceSessionStreamState } from '../types/voice-server.types';
import { VoiceSessionModel } from './voice-session.model';
import { VoiceSessionStateMachine } from './voice-session.state-machine';
import { VoiceSessionNotFoundError } from '../errors/voice-server.errors';

export class VoiceSessionManager implements IVoiceSessionManager {
  // Map keyed by public sessionId
  private readonly sessions: Map<string, VoiceSessionModel> = new Map();
  // Rate limiting tracker: tenantId -> timestamps of creations
  private readonly creationTimestamps: Map<string, number[]> = new Map();

  constructor(
    private readonly config: { rateLimitSessionsPerMinute: number }
  ) {}

  public async createSession(params: {
    tenantId: string;
    clinicId: string | null;
    provider: string;
    providerCallId: string;
    metadata?: Record<string, unknown>;
  }): Promise<SafeVoiceSession> {
    // Generate internal ID and public ID (e.g. prefix vses_)
    const id = this.generateUuid();
    const publicId = `vses_${this.generateRandomString(12)}`;

    const session = new VoiceSessionModel({
      id,
      publicId,
      tenantId: params.tenantId,
      clinicId: params.clinicId,
      provider: params.provider,
      providerCallId: params.providerCallId,
      metadata: params.metadata ?? {},
    });

    this.sessions.set(publicId, session);

    // Track creation timestamp for rate limiting
    const now = Date.now();
    const timestamps = this.creationTimestamps.get(params.tenantId) ?? [];
    timestamps.push(now);
    this.creationTimestamps.set(params.tenantId, timestamps);

    return session.toSafeSession();
  }

  public async getSession(sessionId: string, tenantId: string): Promise<SafeVoiceSession> {
    const session = this.sessions.get(sessionId);
    if (!session || session.tenantId !== tenantId) {
      throw new VoiceSessionNotFoundError(sessionId);
    }
    return session.toSafeSession();
  }

  public async updateSessionState(
    sessionId: string,
    tenantId: string,
    state: VoiceSessionState
  ): Promise<SafeVoiceSession> {
    const session = this.sessions.get(sessionId);
    if (!session || session.tenantId !== tenantId) {
      throw new VoiceSessionNotFoundError(sessionId);
    }

    VoiceSessionStateMachine.validateTransition(session.connectionState, state);

    const updated = session.copyWith({
      connectionState: state,
      endedAt: VoiceSessionStateMachine.isTerminal(state) ? new Date() : session.endedAt,
    });

    this.sessions.set(sessionId, updated);
    return updated.toSafeSession();
  }

  public async updateStreamState(
    sessionId: string,
    tenantId: string,
    state: VoiceSessionStreamState
  ): Promise<SafeVoiceSession> {
    const session = this.sessions.get(sessionId);
    if (!session || session.tenantId !== tenantId) {
      throw new VoiceSessionNotFoundError(sessionId);
    }

    const updated = session.copyWith({
      streamState: state,
    });

    this.sessions.set(sessionId, updated);
    return updated.toSafeSession();
  }

  public async endSession(
    sessionId: string,
    tenantId: string,
    error?: { code: string; message: string }
  ): Promise<SafeVoiceSession> {
    const session = this.sessions.get(sessionId);
    if (!session || session.tenantId !== tenantId) {
      throw new VoiceSessionNotFoundError(sessionId);
    }

    const targetState = error ? 'FAILED' : 'ENDED';
    VoiceSessionStateMachine.validateTransition(session.connectionState, targetState);

    const updated = session.copyWith({
      connectionState: targetState,
      endedAt: new Date(),
      metadata: error ? { ...session.metadata, lastError: error } : session.metadata,
    });

    this.sessions.set(sessionId, updated);
    return updated.toSafeSession();
  }

  public async listActiveSessions(tenantId: string): Promise<SafeVoiceSession[]> {
    const list: SafeVoiceSession[] = [];
    for (const session of this.sessions.values()) {
      if (session.tenantId === tenantId && !VoiceSessionStateMachine.isTerminal(session.connectionState)) {
        list.push(session.toSafeSession());
      }
    }
    return list;
  }

  public rateLimitCheck(tenantId: string): boolean {
    const now = Date.now();
    const timestamps = this.creationTimestamps.get(tenantId) ?? [];
    
    // Filter timestamps within the last 60 seconds
    const activeWindow = timestamps.filter((t) => now - t < 60000);
    this.creationTimestamps.set(tenantId, activeWindow);

    return activeWindow.length < this.config.rateLimitSessionsPerMinute;
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private generateUuid(): string {
    // Generate basic RFC4122 v4 UUID
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

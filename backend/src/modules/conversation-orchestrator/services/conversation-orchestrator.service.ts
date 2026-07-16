import type {
  IConversationOrchestrator,
  ITurnManager,
  ITranscriptManager,
  IContextSynchronizer,
  IOrchestratorMetricsCollector,
} from '../interfaces/conversation-orchestrator.interfaces';
import type { IOrchestratorEventPublisher } from '../events/conversation-orchestrator.events';
import type { SafeOrchestrationSession } from '../types/conversation-orchestrator.types';
import type { OrchestrationState } from '../constants/conversation-orchestrator.constants';
import { OrchestrationSessionModel } from './orchestration-session.model';
import { OrchestrationSessionStateMachine } from './orchestration-session.state-machine';
import { ConversationNotFoundError, OrchestratorTimeoutError } from '../errors/conversation-orchestrator.errors';
import {
  EVENT_ORCHESTRATOR_CREATED,
  EVENT_ORCHESTRATOR_STARTED,
  EVENT_ORCHESTRATOR_TURN_STARTED,
  EVENT_ORCHESTRATOR_TURN_COMPLETED,
  EVENT_ORCHESTRATOR_INTERRUPTED,
  EVENT_ORCHESTRATOR_RESUMED,
  EVENT_ORCHESTRATOR_COMPLETED,
  EVENT_ORCHESTRATOR_FAILED,
} from '../events/conversation-orchestrator.events';

export class ConversationOrchestratorService implements IConversationOrchestrator {
  private readonly sessions: Map<string, OrchestrationSessionModel> = new Map();
  private readonly sessionTimers: Map<string, Record<string, NodeJS.Timeout>> = new Map();
  private readonly tenantCounters: Map<string, number[]> = new Map();

  constructor(
    private readonly turnManager: ITurnManager,
    private readonly transcriptManager: ITranscriptManager,
    private readonly contextSynchronizer: IContextSynchronizer,
    private readonly publisher: IOrchestratorEventPublisher,
    private readonly metrics: IOrchestratorMetricsCollector,
    private readonly config: {
      rateLimitConversationsPerMinute: number;
      aiTimeoutMs: number;
      inactivityTimeoutMs: number;
    }
  ) {}

  public async createSession(params: {
    tenantId: string;
    clinicId: string | null;
    conversationId: string;
    metadata?: Record<string, unknown>;
  }): Promise<SafeOrchestrationSession> {
    const id = this.generateUuid();
    const publicId = `orch_ses_${this.generateRandomString(12)}`;

    const session = new OrchestrationSessionModel({
      id,
      publicId,
      tenantId: params.tenantId,
      clinicId: params.clinicId,
      conversationId: params.conversationId,
    });

    this.sessions.set(publicId, session);
    this.sessionTimers.set(publicId, {});

    // Sync baseline context
    this.contextSynchronizer.synchronizeContext(publicId, {
      tenantId: params.tenantId,
      clinicId: params.clinicId,
      conversationId: params.conversationId,
      providerMetadata: params.metadata ?? {},
    });

    // Track creation counter
    const now = Date.now();
    const list = this.tenantCounters.get(params.tenantId) ?? [];
    list.push(now);
    this.tenantCounters.set(params.tenantId, list);

    this.metrics.trackSessionStart(params.tenantId);

    await this.publisher.publish({
      type: EVENT_ORCHESTRATOR_CREATED,
      payload: {
        sessionId: publicId,
        tenantId: params.tenantId,
        clinicId: params.clinicId,
        conversationId: params.conversationId,
        occurredAt: new Date(),
      },
    });

    // Automatically transition to INITIALIZING
    return this.updateState(publicId, params.tenantId, 'INITIALIZING');
  }

  public async getSession(sessionId: string, tenantId: string): Promise<SafeOrchestrationSession> {
    const session = this.sessions.get(sessionId);
    if (!session || session.tenantId !== tenantId) {
      throw new ConversationNotFoundError(sessionId);
    }

    // Refresh context and turn parameters on output
    const activeTurns = this.turnManager.getCurrentTurn(sessionId) 
      ? [this.turnManager.getCurrentTurn(sessionId)!] 
      : [];

    return session.copyWith({
      context: this.contextSynchronizer.getContext(sessionId),
      turns: [...this.transcriptManager.getTranscriptHistory(sessionId), ...activeTurns],
    }).toSafeSession();
  }

  public async updateState(
    sessionId: string,
    tenantId: string,
    state: OrchestrationState
  ): Promise<SafeOrchestrationSession> {
    const session = this.sessions.get(sessionId);
    if (!session || session.tenantId !== tenantId) {
      throw new ConversationNotFoundError(sessionId);
    }

    OrchestrationSessionStateMachine.validateTransition(session.state, state);

    // Cancel old state timers on new transition
    this.clearStateTimers(sessionId);

    let finalTurns = this.transcriptManager.getTranscriptHistory(sessionId);

    // Apply turn-specific updates
    if (state === 'LISTENING') {
      const turn = this.turnManager.startUserTurn(sessionId);
      await this.publisher.publish({
        type: EVENT_ORCHESTRATOR_TURN_STARTED,
        payload: { sessionId, tenantId, turn, occurredAt: new Date() },
      });
      // Setup inactivity check
      this.setupStateTimer(sessionId, 'inactivity', this.config.inactivityTimeoutMs, () => {
        this.handleTimeout(sessionId, tenantId, 'inactivity', this.config.inactivityTimeoutMs);
      });
    } else if (state === 'PROCESSING') {
      // Complete user turn if active
      try {
        const userTurn = this.turnManager.completeUserTurn(sessionId, 'User input transcript.');
        this.transcriptManager.appendTranscript(sessionId, 'user', userTurn.transcript, true);
        await this.publisher.publish({
          type: EVENT_ORCHESTRATOR_TURN_COMPLETED,
          payload: { sessionId, tenantId, turn: userTurn, occurredAt: new Date() },
        });
      } catch {
        // Safe check
      }

      // Setup AI response check
      this.setupStateTimer(sessionId, 'ai_completion', this.config.aiTimeoutMs, () => {
        this.handleTimeout(sessionId, tenantId, 'ai_completion', this.config.aiTimeoutMs);
      });
    } else if (state === 'RESPONDING') {
      const turn = this.turnManager.startAssistantTurn(sessionId);
      await this.publisher.publish({
        type: EVENT_ORCHESTRATOR_TURN_STARTED,
        payload: { sessionId, tenantId, turn, occurredAt: new Date() },
      });
    } else if (state === 'WAITING') {
      // Complete assistant turn
      try {
        const asstTurn = this.turnManager.completeAssistantTurn(sessionId, 'Assistant output speech.');
        this.transcriptManager.appendTranscript(sessionId, 'assistant', asstTurn.transcript, true);
        await this.publisher.publish({
          type: EVENT_ORCHESTRATOR_TURN_COMPLETED,
          payload: { sessionId, tenantId, turn: asstTurn, occurredAt: new Date() },
        });
      } catch {
        // Safe check
      }
    }

    const updated = session.copyWith({
      state,
      turns: this.transcriptManager.getTranscriptHistory(sessionId),
      endedAt: OrchestrationSessionStateMachine.isTerminal(state) ? new Date() : session.endedAt,
    });

    this.sessions.set(sessionId, updated);

    // Handle domain event mappings
    if (state === 'INITIALIZING') {
      await this.publisher.publish({
        type: EVENT_ORCHESTRATOR_STARTED,
        payload: { sessionId, tenantId, occurredAt: new Date() },
      });
    } else if (state === 'COMPLETED') {
      const dur = Date.now() - session.createdAt.getTime();
      this.metrics.trackSessionEnd(tenantId, dur);
      this.metrics.trackTranscriptSize(this.transcriptManager.getTranscriptCharacterCount(sessionId));
      await this.publisher.publish({
        type: EVENT_ORCHESTRATOR_COMPLETED,
        payload: { sessionId, tenantId, durationMs: dur, occurredAt: new Date() },
      });
      this.cleanupMemoryResources(sessionId);
    }

    return updated.toSafeSession();
  }

  public async handleInterruption(
    sessionId: string,
    tenantId: string,
    audioOffsetMs: number
  ): Promise<SafeOrchestrationSession> {
    const session = this.sessions.get(sessionId);
    if (!session || session.tenantId !== tenantId) {
      throw new ConversationNotFoundError(sessionId);
    }

    // Move to INTERRUPTED state
    OrchestrationSessionStateMachine.validateTransition(session.state, 'INTERRUPTED');
    this.clearStateTimers(sessionId);

    // Terminate current active turn as interrupted
    this.turnManager.interruptCurrentTurn(sessionId);
    this.metrics.trackInterruption();

    await this.publisher.publish({
      type: EVENT_ORCHESTRATOR_INTERRUPTED,
      payload: { sessionId, tenantId, audioOffsetMs, occurredAt: new Date() },
    });

    const updated = session.copyWith({
      state: 'INTERRUPTED',
      turns: this.transcriptManager.getTranscriptHistory(sessionId),
    });

    this.sessions.set(sessionId, updated);

    // Automatically transition to RESUMED to restore context
    return this.resumeInterruptedSession(sessionId, tenantId);
  }

  private async resumeInterruptedSession(sessionId: string, tenantId: string): Promise<SafeOrchestrationSession> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new ConversationNotFoundError(sessionId);

    OrchestrationSessionStateMachine.validateTransition(session.state, 'RESUMED');
    
    await this.publisher.publish({
      type: EVENT_ORCHESTRATOR_RESUMED,
      payload: { sessionId, tenantId, occurredAt: new Date() },
    });

    const updated = session.copyWith({ state: 'RESUMED' });
    this.sessions.set(sessionId, updated);

    // Re-route to Listening for user continuation
    return this.updateState(sessionId, tenantId, 'LISTENING');
  }

  public async endSession(
    sessionId: string,
    tenantId: string,
    error?: { code: string; message: string }
  ): Promise<SafeOrchestrationSession> {
    const session = this.sessions.get(sessionId);
    if (!session || session.tenantId !== tenantId) {
      throw new ConversationNotFoundError(sessionId);
    }

    const targetState = error ? 'FAILED' : 'ENDING';
    OrchestrationSessionStateMachine.validateTransition(session.state, targetState);

    this.clearStateTimers(sessionId);

    if (error) {
      const failed = session.copyWith({
        state: 'FAILED',
        endedAt: new Date(),
        turns: this.transcriptManager.finalizeTranscript(sessionId),
      });
      this.sessions.set(sessionId, failed);
      
      const dur = Date.now() - session.createdAt.getTime();
      this.metrics.trackSessionEnd(tenantId, dur);

      await this.publisher.publish({
        type: EVENT_ORCHESTRATOR_FAILED,
        payload: {
          sessionId,
          tenantId,
          errorCode: error.code,
          errorMessage: error.message,
          occurredAt: new Date(),
        },
      });

      this.cleanupMemoryResources(sessionId);
      return failed.toSafeSession();
    }

    // Graceful closure path (ENDING -> COMPLETED)
    await this.updateState(sessionId, tenantId, 'ENDING');
    return this.updateState(sessionId, tenantId, 'COMPLETED');
  }

  public async listActiveSessions(tenantId: string): Promise<SafeOrchestrationSession[]> {
    const list: SafeOrchestrationSession[] = [];
    for (const session of this.sessions.values()) {
      if (session.tenantId === tenantId && !OrchestrationSessionStateMachine.isTerminal(session.state)) {
        list.push(session.toSafeSession());
      }
    }
    return list;
  }

  public rateLimitCheck(tenantId: string): boolean {
    const now = Date.now();
    const timestamps = this.tenantCounters.get(tenantId) ?? [];

    const active = timestamps.filter((t) => now - t < 60000);
    this.tenantCounters.set(tenantId, active);

    return active.length < this.config.rateLimitConversationsPerMinute;
  }

  // ---------------------------------------------------------------------------
  // Memory and Timer Management (Memory Safety)
  // ---------------------------------------------------------------------------

  private setupStateTimer(sessionId: string, timerKey: string, delayMs: number, cb: () => void): void {
    const active = this.sessionTimers.get(sessionId) ?? {};
    if (active[timerKey]) {
      clearTimeout(active[timerKey]);
    }
    active[timerKey] = setTimeout(cb, delayMs);
    this.sessionTimers.set(sessionId, active);
  }

  private clearStateTimers(sessionId: string): void {
    const active = this.sessionTimers.get(sessionId);
    if (active) {
      for (const timer of Object.values(active)) {
        clearTimeout(timer);
      }
      this.sessionTimers.set(sessionId, {});
    }
  }

  private cleanupMemoryResources(sessionId: string): void {
    // Release all timers
    this.clearStateTimers(sessionId);
    this.sessionTimers.delete(sessionId);

    // Release context maps
    this.contextSynchronizer.clearSessionContext(sessionId);

    // Release turns maps
    this.turnManager.clearSessionTurns(sessionId);

    // Release transcripts maps
    this.transcriptManager.clearSessionTranscript(sessionId);

    // Remove active model reference
    this.sessions.delete(sessionId);
  }

  private handleTimeout(sessionId: string, tenantId: string, type: string, limitMs: number): void {
    this.metrics.trackTimeout();
    const error = new OrchestratorTimeoutError(type, limitMs);
    
    // Dispatches failure closure path
    this.endSession(sessionId, tenantId, {
      code: error.code,
      message: error.message,
    }).catch((err) => {
      console.error(`[ConversationOrchestrator] Graceful timeout redirection failure for ${sessionId}:`, err);
    });
  }

  // ---------------------------------------------------------------------------
  // Generator Helpers
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

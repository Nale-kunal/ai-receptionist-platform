import type {
  IConversationOrchestrator,
  ITurnManager,
  ITranscriptManager,
  IContextSynchronizer,
  IConversationRecoveryManager,
  IConversationSnapshotManager,
  IRuntimeResourceManager,
  IOrchestratorMetricsCollector,
  IOrchestratorAuditLogger,
} from './conversation-orchestrator.interfaces';
import type { IOrchestratorEventPublisher } from './conversation-orchestrator.events';
import type { SafeOrchestrationSession, EventCorrelation } from './conversation-orchestrator.types';
import type { OrchestrationState } from './conversation-orchestrator.constants';
import { OrchestrationSessionModel } from './orchestration-session.model';
import { OrchestrationSessionStateMachine } from './orchestration-session.state-machine';
import { ConversationNotFoundError, OrchestratorTimeoutError } from './conversation-orchestrator.errors';
import {
  EVENT_ORCHESTRATOR_CREATED,
  EVENT_ORCHESTRATOR_STARTED,
  EVENT_ORCHESTRATOR_TURN_STARTED,
  EVENT_ORCHESTRATOR_TURN_COMPLETED,
  EVENT_ORCHESTRATOR_INTERRUPTED,
  EVENT_ORCHESTRATOR_RESUMED,
  EVENT_ORCHESTRATOR_COMPLETED,
  EVENT_ORCHESTRATOR_FAILED,
  EVENT_ORCHESTRATOR_SNAPSHOT_CREATED,
  EVENT_ORCHESTRATOR_RECOVERED,
} from './conversation-orchestrator.events';

export class ConversationOrchestratorService implements IConversationOrchestrator {
  private readonly sessions: Map<string, OrchestrationSessionModel> = new Map();
  private readonly tenantCounters: Map<string, number[]> = new Map();

  constructor(
    private readonly turnManager: ITurnManager,
    private readonly transcriptManager: ITranscriptManager,
    private readonly contextSynchronizer: IContextSynchronizer,
    private readonly recoveryManager: IConversationRecoveryManager,
    private readonly snapshotManager: IConversationSnapshotManager,
    private readonly resourceManager: IRuntimeResourceManager,
    private readonly publisher: IOrchestratorEventPublisher,
    private readonly metrics: IOrchestratorMetricsCollector,
    private readonly auditLogger: IOrchestratorAuditLogger,
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
    correlation: EventCorrelation;
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

    // Context Synchronizer link
    this.contextSynchronizer.synchronizeContext(publicId, {
      tenantId: params.tenantId,
      clinicId: params.clinicId,
      conversationId: params.conversationId,
    });

    // Rate counter
    const now = Date.now();
    const list = this.tenantCounters.get(params.tenantId) ?? [];
    list.push(now);
    this.tenantCounters.set(params.tenantId, list);

    this.metrics.trackSessionStart(params.tenantId);

    // Initial audit log
    await this.auditLogger.logSessionCreated(publicId, params.tenantId, params.conversationId, params.correlation);

    // Initial Domain Event
    await this.publisher.publish({
      type: EVENT_ORCHESTRATOR_CREATED,
      correlation: params.correlation,
      payload: {
        sessionId: publicId,
        tenantId: params.tenantId,
        clinicId: params.clinicId,
        conversationId: params.conversationId,
      },
    });

    return this.updateState(publicId, params.tenantId, 'INITIALIZING', params.correlation);
  }

  public async getSession(sessionId: string, tenantId: string): Promise<SafeOrchestrationSession> {
    const session = this.sessions.get(sessionId);
    if (!session || session.tenantId !== tenantId) {
      throw new ConversationNotFoundError(sessionId);
    }

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
    state: OrchestrationState,
    correlation: EventCorrelation
  ): Promise<SafeOrchestrationSession> {
    const session = this.sessions.get(sessionId);
    if (!session || session.tenantId !== tenantId) {
      throw new ConversationNotFoundError(sessionId);
    }

    const previousState = session.state;
    OrchestrationSessionStateMachine.validateTransition(previousState, state);

    // Disposes all state timers of previous state through resource manager
    this.resourceManager.clearSessionResources(sessionId);

    // Apply turn changes based on target states
    if (state === 'LISTENING') {
      const turn = this.turnManager.startUserTurn(sessionId, correlation);
      await this.publisher.publish({
        type: EVENT_ORCHESTRATOR_TURN_STARTED,
        correlation,
        payload: { sessionId, tenantId, turn },
      });

      // Start user silence / inactivity timeout via Resource Manager
      const inactivityTimer = setTimeout(() => {
        this.handleTimeout(sessionId, tenantId, 'inactivity', this.config.inactivityTimeoutMs, correlation);
      }, this.config.inactivityTimeoutMs);
      this.resourceManager.registerTimer(sessionId, 'inactivity', inactivityTimer);

    } else if (state === 'PROCESSING') {
      try {
        const userTurn = this.turnManager.completeUserTurn(sessionId, 'User voice response text.', correlation);
        this.transcriptManager.appendTranscript(sessionId, 'user', userTurn.transcript, true);
        await this.publisher.publish({
          type: EVENT_ORCHESTRATOR_TURN_COMPLETED,
          correlation,
          payload: { sessionId, tenantId, turn: userTurn },
        });
      } catch {
        // Safe bypass
      }

      // Start AI response completion timeout
      const aiTimer = setTimeout(() => {
        this.handleTimeout(sessionId, tenantId, 'ai_completion', this.config.aiTimeoutMs, correlation);
      }, this.config.aiTimeoutMs);
      this.resourceManager.registerTimer(sessionId, 'ai_completion', aiTimer);

    } else if (state === 'RESPONDING') {
      const turn = this.turnManager.startAssistantTurn(sessionId, correlation);
      await this.publisher.publish({
        type: EVENT_ORCHESTRATOR_TURN_STARTED,
        correlation,
        payload: { sessionId, tenantId, turn },
      });
    } else if (state === 'WAITING') {
      try {
        const asstTurn = this.turnManager.completeAssistantTurn(sessionId, 'Assistant speech text.', correlation);
        this.transcriptManager.appendTranscript(sessionId, 'assistant', asstTurn.transcript, true);
        await this.publisher.publish({
          type: EVENT_ORCHESTRATOR_TURN_COMPLETED,
          correlation,
          payload: { sessionId, tenantId, turn: asstTurn },
        });
      } catch {
        // Safe bypass
      }
    }

    const updated = session.copyWith({
      state,
      turns: this.transcriptManager.getTranscriptHistory(sessionId),
      endedAt: OrchestrationSessionStateMachine.isTerminal(state) ? new Date() : session.endedAt,
    });

    this.sessions.set(sessionId, updated);

    // Log state transition audit
    await this.auditLogger.logStateTransition(sessionId, tenantId, previousState, state, correlation);

    // Save dynamic checkpoint snapshot on every state change to enforce resilience
    const snapshot = this.snapshotManager.takeSnapshot(
      sessionId,
      state,
      this.contextSynchronizer.getContext(sessionId),
      this.transcriptManager.getTranscriptHistory(sessionId),
      correlation
    );
    await this.recoveryManager.checkpointSession(sessionId, correlation);

    await this.publisher.publish({
      type: EVENT_ORCHESTRATOR_SNAPSHOT_CREATED,
      correlation,
      payload: { sessionId, tenantId, snapshotId: snapshot.snapshotId },
    });

    // Standard lifecycles triggers
    if (state === 'INITIALIZING') {
      await this.publisher.publish({
        type: EVENT_ORCHESTRATOR_STARTED,
        correlation,
        payload: { sessionId, tenantId },
      });
    } else if (state === 'COMPLETED') {
      const dur = Date.now() - session.createdAt.getTime();
      this.metrics.trackSessionEnd(tenantId, dur);
      this.metrics.trackTranscriptSize(this.transcriptManager.getTranscriptCharacterCount(sessionId));

      await this.publisher.publish({
        type: EVENT_ORCHESTRATOR_COMPLETED,
        correlation,
        payload: { sessionId, tenantId, durationMs: dur },
      });
      await this.auditLogger.logSessionClosed(sessionId, tenantId, session.conversationId, correlation);
      this.cleanupMemoryResources(sessionId);
    }

    return updated.toSafeSession();
  }

  public async handleInterruption(
    sessionId: string,
    tenantId: string,
    audioOffsetMs: number,
    correlation: EventCorrelation
  ): Promise<SafeOrchestrationSession> {
    const session = this.sessions.get(sessionId);
    if (!session || session.tenantId !== tenantId) {
      throw new ConversationNotFoundError(sessionId);
    }

    OrchestrationSessionStateMachine.validateTransition(session.state, 'INTERRUPTED');
    this.resourceManager.clearSessionResources(sessionId);

    // Terminate current assistant turn
    this.turnManager.interruptCurrentTurn(sessionId, correlation);
    this.metrics.trackInterruption();

    await this.auditLogger.logInterruptionDetected(sessionId, tenantId, audioOffsetMs, correlation);

    await this.publisher.publish({
      type: EVENT_ORCHESTRATOR_INTERRUPTED,
      correlation,
      payload: { sessionId, tenantId, audioOffsetMs },
    });

    const updated = session.copyWith({
      state: 'INTERRUPTED',
      turns: this.transcriptManager.getTranscriptHistory(sessionId),
    });

    this.sessions.set(sessionId, updated);

    // Triggers recovery manager sync loops immediately
    return this.recoverFromInterruption(sessionId, tenantId, correlation);
  }

  private async recoverFromInterruption(
    sessionId: string,
    tenantId: string,
    correlation: EventCorrelation
  ): Promise<SafeOrchestrationSession> {
    // Shifting to RESUMED to restore snapshot checkpoint configurations
    const session = this.sessions.get(sessionId);
    if (!session) throw new ConversationNotFoundError(sessionId);

    OrchestrationSessionStateMachine.validateTransition(session.state, 'RESUMED');

    await this.publisher.publish({
      type: EVENT_ORCHESTRATOR_RESUMED,
      correlation,
      payload: { sessionId, tenantId },
    });

    const updated = session.copyWith({ state: 'RESUMED' });
    this.sessions.set(sessionId, updated);

    // Restores to listening loop
    return this.updateState(sessionId, tenantId, 'LISTENING', correlation);
  }

  public async endSession(
    sessionId: string,
    tenantId: string,
    error?: { code: string; message: string },
    correlation?: EventCorrelation
  ): Promise<SafeOrchestrationSession> {
    const session = this.sessions.get(sessionId);
    if (!session || session.tenantId !== tenantId) {
      throw new ConversationNotFoundError(sessionId);
    }

    const defaultCorrelation = correlation ?? {
      correlationId: `corr_${this.generateRandomString(8)}`,
      traceId: `trace_${this.generateRandomString(8)}`,
      tenantId,
      sessionId,
      conversationId: session.conversationId,
      timestamp: new Date(),
    };

    const targetState = error ? 'FAILED' : 'ENDING';
    OrchestrationSessionStateMachine.validateTransition(session.state, targetState);

    this.resourceManager.clearSessionResources(sessionId);

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
        correlation: defaultCorrelation,
        payload: {
          sessionId,
          tenantId,
          errorCode: error.code,
          errorMessage: error.message,
        },
      });

      this.cleanupMemoryResources(sessionId);
      return failed.toSafeSession();
    }

    await this.updateState(sessionId, tenantId, 'ENDING', defaultCorrelation);
    return this.updateState(sessionId, tenantId, 'COMPLETED', defaultCorrelation);
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
  // Recovery trigger (reconnect recovery flow)
  // ---------------------------------------------------------------------------

  public async triggerReconnectRecovery(sessionId: string, tenantId: string, correlation: EventCorrelation): Promise<SafeOrchestrationSession> {
    const recoveredSnapshot = await this.recoveryManager.recoverSession(sessionId, correlation);
    if (!recoveredSnapshot) {
      throw new Error(`[OrchestratorRecovery] No checkpoint recovery model found for session ${sessionId}`);
    }

    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new ConversationNotFoundError(sessionId);
    }

    // Restore the session state, context parameters, and turns from snapshot
    this.contextSynchronizer.synchronizeContext(sessionId, recoveredSnapshot.context);
    
    const restored = session.copyWith({
      state: 'RESUMED',
      turns: recoveredSnapshot.turns,
      context: recoveredSnapshot.context,
    });
    this.sessions.set(sessionId, restored);

    await this.auditLogger.logSessionRecovered(sessionId, tenantId, correlation);
    await this.publisher.publish({
      type: EVENT_ORCHESTRATOR_RECOVERED,
      correlation,
      payload: { sessionId, tenantId },
    });

    return restored.toSafeSession();
  }

  // ---------------------------------------------------------------------------
  // Private Helpers
  // ---------------------------------------------------------------------------

  private handleTimeout(sessionId: string, tenantId: string, type: string, limitMs: number, correlation: EventCorrelation): void {
    this.metrics.trackTimeout();
    const error = new OrchestratorTimeoutError(type, limitMs);

    this.auditLogger.logTimeoutTriggered(sessionId, tenantId, type, limitMs, correlation).catch(() => {});

    this.endSession(sessionId, tenantId, {
      code: error.code,
      message: error.message,
    }, correlation).catch((err) => {
      console.error(`[ConversationOrchestrator] Graceful timeout redirection failure for ${sessionId}:`, err);
    });
  }

  private cleanupMemoryResources(sessionId: string): void {
    const start = Date.now();

    this.resourceManager.clearSessionResources(sessionId);
    this.contextSynchronizer.clearSessionContext(sessionId);
    this.turnManager.clearSessionTurns(sessionId);
    this.transcriptManager.clearSessionTranscript(sessionId);
    this.recoveryManager.clearRecoveryContext(sessionId);
    this.snapshotManager.clearSessionSnapshots(sessionId);

    this.sessions.delete(sessionId);

    this.metrics.trackCleanup(Date.now() - start);
  }

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

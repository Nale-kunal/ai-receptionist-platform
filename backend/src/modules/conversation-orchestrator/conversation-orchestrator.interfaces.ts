import type {
  SafeOrchestrationSession,
  OrchestrationTurn,
  OrchestrationContext,
  ConversationSnapshot,
  EventCorrelation,
  OrchestratorMetrics,
} from './conversation-orchestrator.types';
import type { OrchestrationState } from './conversation-orchestrator.constants';

export interface IConversationOrchestrator {
  createSession(params: {
    tenantId: string;
    clinicId: string | null;
    conversationId: string;
    correlation: EventCorrelation;
  }): Promise<SafeOrchestrationSession>;

  getSession(sessionId: string, tenantId: string): Promise<SafeOrchestrationSession>;
  updateState(sessionId: string, tenantId: string, state: OrchestrationState, correlation: EventCorrelation): Promise<SafeOrchestrationSession>;
  handleInterruption(sessionId: string, tenantId: string, audioOffsetMs: number, correlation: EventCorrelation): Promise<SafeOrchestrationSession>;
  endSession(sessionId: string, tenantId: string, error?: { code: string; message: string }, correlation?: EventCorrelation): Promise<SafeOrchestrationSession>;
  listActiveSessions(tenantId: string): Promise<SafeOrchestrationSession[]>;
  rateLimitCheck(tenantId: string): boolean;
}

export interface ITurnManager {
  startUserTurn(sessionId: string, correlation: EventCorrelation): OrchestrationTurn;
  completeUserTurn(sessionId: string, text: string, correlation: EventCorrelation): OrchestrationTurn;
  startAssistantTurn(sessionId: string, correlation: EventCorrelation): OrchestrationTurn;
  completeAssistantTurn(sessionId: string, text: string, correlation: EventCorrelation): OrchestrationTurn;
  interruptCurrentTurn(sessionId: string, correlation: EventCorrelation): OrchestrationTurn | null;
  getCurrentTurn(sessionId: string): OrchestrationTurn | null;
  clearSessionTurns(sessionId: string): void;
}

export interface ITranscriptManager {
  appendTranscript(sessionId: string, speaker: 'user' | 'assistant', text: string, isFinal: boolean): void;
  finalizeTranscript(sessionId: string): OrchestrationTurn[];
  getTranscriptHistory(sessionId: string): OrchestrationTurn[];
  getTranscriptCharacterCount(sessionId: string): number;
  clearSessionTranscript(sessionId: string): void;
}

export interface IContextSynchronizer {
  synchronizeContext(sessionId: string, updates: Partial<OrchestrationContext>): OrchestrationContext;
  getContext(sessionId: string): OrchestrationContext;
  clearSessionContext(sessionId: string): void;
}

export interface IConversationRecoveryManager {
  checkpointSession(sessionId: string, correlation: EventCorrelation): Promise<void>;
  recoverSession(sessionId: string, correlation: EventCorrelation): Promise<ConversationSnapshot | null>;
  clearRecoveryContext(sessionId: string): void;
}

export interface IConversationSnapshotManager {
  takeSnapshot(sessionId: string, state: OrchestrationState, context: OrchestrationContext, turns: OrchestrationTurn[], correlation: EventCorrelation): ConversationSnapshot;
  getLatestSnapshot(sessionId: string): ConversationSnapshot | null;
  clearSessionSnapshots(sessionId: string): void;
}

export interface IRuntimeResourceManager {
  registerTimer(sessionId: string, key: string, timer: NodeJS.Timeout): void;
  registerListener(sessionId: string, emitter: any, event: string, handler: (...args: any[]) => void): void;
  clearSessionResources(sessionId: string): void;
}

export interface IOrchestratorMetricsCollector {
  trackSessionStart(tenantId: string): void;
  trackSessionEnd(tenantId: string, durationMs: number): void;
  trackInterruption(): void;
  trackResume(): void;
  trackResponse(): void;
  trackToolRequest(): void;
  trackReconnect(): void;
  trackTimeout(): void;
  trackLatency(latencyMs: number): void;
  trackTranscriptSize(charCount: number): void;
  trackTransition(durationMs: number): void;
  trackCleanup(durationMs: number): void;
  getMetrics(): OrchestratorMetrics;
}

export interface IOrchestratorAuditLogger {
  logSessionCreated(sessionId: string, tenantId: string, conversationId: string, correlation: EventCorrelation): Promise<void>;
  logSessionClosed(sessionId: string, tenantId: string, conversationId: string, correlation: EventCorrelation): Promise<void>;
  logStateTransition(sessionId: string, tenantId: string, from: string, to: string, correlation: EventCorrelation): Promise<void>;
  logTimeoutTriggered(sessionId: string, tenantId: string, timeoutType: string, limitMs: number, correlation: EventCorrelation): Promise<void>;
  logInterruptionDetected(sessionId: string, tenantId: string, audioOffsetMs: number, correlation: EventCorrelation): Promise<void>;
  logSnapshotCreated(sessionId: string, tenantId: string, snapshotId: string, correlation: EventCorrelation): Promise<void>;
  logSessionRecovered(sessionId: string, tenantId: string, correlation: EventCorrelation): Promise<void>;
}

// ---------------------------------------------------------------------------
// Distributed System Hook Contracts (Exposed for Redis/NATS/PgAdvisoryLocks)
// ---------------------------------------------------------------------------

export interface IConversationLockProvider {
  acquireLock(sessionId: string, ttlMs: number): Promise<boolean>;
  releaseLock(sessionId: string): Promise<void>;
}

export interface IConversationSnapshotStore {
  saveSnapshot(snapshot: ConversationSnapshot): Promise<void>;
  loadSnapshot(sessionId: string): Promise<ConversationSnapshot | null>;
  deleteSnapshots(sessionId: string): Promise<void>;
}

export interface IConversationRecoveryProvider {
  registerRecoverableSession(sessionId: string, ttlMs: number): Promise<void>;
  isSessionRecoverable(sessionId: string): Promise<boolean>;
  removeRecoveryToken(sessionId: string): Promise<void>;
}

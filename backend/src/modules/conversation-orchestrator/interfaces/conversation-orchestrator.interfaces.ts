import type {
  SafeOrchestrationSession,
  OrchestrationTurn,
  OrchestrationContext,
  OrchestratorMetrics,
} from '../types/conversation-orchestrator.types';
import type { OrchestrationState } from '../constants/conversation-orchestrator.constants';

export interface IConversationOrchestrator {
  createSession(params: {
    tenantId: string;
    clinicId: string | null;
    conversationId: string;
    metadata?: Record<string, unknown>;
  }): Promise<SafeOrchestrationSession>;

  getSession(sessionId: string, tenantId: string): Promise<SafeOrchestrationSession>;
  updateState(sessionId: string, tenantId: string, state: OrchestrationState): Promise<SafeOrchestrationSession>;
  handleInterruption(sessionId: string, tenantId: string, audioOffsetMs: number): Promise<SafeOrchestrationSession>;
  endSession(sessionId: string, tenantId: string, error?: { code: string; message: string }): Promise<SafeOrchestrationSession>;
  listActiveSessions(tenantId: string): Promise<SafeOrchestrationSession[]>;
  rateLimitCheck(tenantId: string): boolean;
}

export interface ITurnManager {
  startUserTurn(sessionId: string): OrchestrationTurn;
  completeUserTurn(sessionId: string, text: string): OrchestrationTurn;
  startAssistantTurn(sessionId: string): OrchestrationTurn;
  completeAssistantTurn(sessionId: string, text: string): OrchestrationTurn;
  interruptCurrentTurn(sessionId: string): OrchestrationTurn | null;
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
  synchronizeContext(
    sessionId: string,
    updates: Partial<OrchestrationContext>
  ): OrchestrationContext;
  getContext(sessionId: string): OrchestrationContext;
  clearSessionContext(sessionId: string): void;
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
  getMetrics(): OrchestratorMetrics;
}

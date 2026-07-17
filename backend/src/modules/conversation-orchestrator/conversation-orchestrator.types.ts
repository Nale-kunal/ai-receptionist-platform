import type { OrchestrationState } from './conversation-orchestrator.constants';

// ---------------------------------------------------------------------------
// Correlation / Trace Context (Mandatory for enterprise audits)
// ---------------------------------------------------------------------------

export interface EventCorrelation {
  correlationId: string;
  traceId: string;
  tenantId: string;
  sessionId: string;
  conversationId: string;
  timestamp: Date;
}

// ---------------------------------------------------------------------------
// Orchestration Context
// ---------------------------------------------------------------------------

export interface OrchestrationContext {
  tenantId: string;
  clinicId: string | null;
  patientId: string | null;
  doctorId: string | null;
  appointmentId: string | null;
  conversationId: string;
  aiSessionId: string | null;
  promptVersion: number | null;
  variables: Record<string, string>;
  providerMetadata: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Turn Structure
// ---------------------------------------------------------------------------

export interface OrchestrationTurn {
  turnId: string;
  speaker: 'user' | 'assistant';
  status: 'started' | 'completed' | 'interrupted';
  transcript: string;
  startedAt: Date;
  completedAt: Date | null;
}

// ---------------------------------------------------------------------------
// Serialization / Snapshot representation
// ---------------------------------------------------------------------------

export interface ConversationSnapshot {
  snapshotId: string;
  sessionId: string;
  tenantId: string;
  state: OrchestrationState;
  context: OrchestrationContext;
  turns: OrchestrationTurn[];
  correlation: EventCorrelation;
  createdAt: Date;
}

// ---------------------------------------------------------------------------
// DTO & Safe Session
// ---------------------------------------------------------------------------

export interface SafeOrchestrationSession {
  sessionId: string;
  tenantId: string;
  clinicId: string | null;
  conversationId: string;
  state: OrchestrationState;
  createdAt: Date;
  updatedAt: Date;
  endedAt: Date | null;
  turns: OrchestrationTurn[];
  context: OrchestrationContext;
}

// ---------------------------------------------------------------------------
// Performance Metrics
// ---------------------------------------------------------------------------

export interface OrchestratorMetrics {
  totalDurationMs: number;
  orchestrationLatencyMs: number;
  aiLatencyMs: number;
  providerLatencyMs: number;
  transcriptCharacterCount: number;
  interruptionCount: number;
  retryCount: number;
  timeoutCount: number;
  recoveryDurationMs: number;
  stateTransitionDurationMs: number;
  cleanupDurationMs: number;
  memoryUsageBytes: number;
  activeConversationsCount: number;
  successRatePercent: number;
}

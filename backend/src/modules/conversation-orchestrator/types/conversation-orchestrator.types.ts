import type { OrchestrationState } from '../constants/conversation-orchestrator.constants';

// ---------------------------------------------------------------------------
// Orchestration Context (synchronized metadata)
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
// Orchestration Turn Structure
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
// Safe Session DTO (hiding internal keys)
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
  averageLatencyMs: number;
  interruptionCount: number;
  resumedSessionsCount: number;
  transcriptCharacterCount: number;
  aiResponseCount: number;
  toolRequestCount: number;
  reconnectCount: number;
  timeoutCount: number;
  completionRate: number;
}

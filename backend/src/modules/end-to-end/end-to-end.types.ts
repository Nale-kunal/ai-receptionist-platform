/**
 * End-to-End Call Flow — Types
 */

import type { E2eCallState } from './end-to-end.constants';

export interface E2eCallContext {
  tenantId: string;
  clinicId: string | null;
  conversationId: string;
  callerNumber: string;
  calledNumber: string;
  startTime: number;
  endTime: number | null;
  variables: Record<string, string>;
  metadata: Record<string, unknown>;
}

export interface E2eCallSession {
  sessionId: string;
  callSid: string;
  voiceSessionId: string | null;
  realtimeSessionId: string | null;
  currentState: E2eCallState;
  context: E2eCallContext;
  createdAt: number;
  updatedAt: number;
}

export interface E2eMetricsSnapshot {
  totalCallsCount: number;
  completedCallsCount: number;
  failedCallsCount: number;
  activeCallsCount: number;
  averageCallDurationMs: number;
  averageAiLatencyMs: number;
  averageToolLatencyMs: number;
  totalInterruptionsCount: number;
  totalRetriesCount: number;
  totalTimeoutsCount: number;
  averageCleanupDurationMs: number;
  callSuccessRate: number;
}

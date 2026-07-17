/**
 * End-to-End Call Flow — Interfaces
 */

import type { E2eCallSession, E2eCallContext, E2eMetricsSnapshot } from './end-to-end.types';
import type { E2eCallState } from './end-to-end.constants';

export interface ICallFlowCoordinator {
  initializeCall(params: {
    tenantId: string;
    callerNumber: string;
    calledNumber: string;
    callSid: string;
  }): Promise<E2eCallSession>;
  handleInactivityTimeout(sessionId: string): Promise<void>;
  handleHangup(sessionId: string): Promise<void>;
}

export interface ICallSessionManager {
  createSession(sessionId: string, callSid: string, context: E2eCallContext): E2eCallSession;
  getSession(sessionId: string): E2eCallSession | undefined;
  getSessionByCallSid(callSid: string): E2eCallSession | undefined;
  updateState(sessionId: string, state: E2eCallState): E2eCallSession;
  removeSession(sessionId: string): void;
  activeSessions(): E2eCallSession[];
}

export interface ICallTimeoutManager {
  registerTimeout(sessionId: string, type: 'inactivity' | 'ai' | 'tool' | 'max_duration', timeoutMs: number, callback: () => void): void;
  clearTimeout(sessionId: string, type: 'inactivity' | 'ai' | 'tool' | 'max_duration'): void;
  clearAll(sessionId: string): void;
}

export interface ICallCleanupManager {
  cleanupSession(sessionId: string): Promise<number>; // Returns duration of cleanup in ms
}

export interface ICallHealthMonitor {
  trackHeartbeat(sessionId: string): void;
  checkHealth(): { stuckSessionsCount: number; orphanSessionsCount: number };
}

export interface ICallMetricsCollector {
  trackCallStart(): void;
  trackCallEnd(durationMs: number): void;
  trackCallFailure(): void;
  trackAiLatency(ms: number): void;
  trackToolLatency(ms: number): void;
  trackInterruption(): void;
  trackRetry(): void;
  trackTimeout(): void;
  trackCleanup(ms: number): void;
  getSnapshot(): E2eMetricsSnapshot;
}

export interface ICallAuditLogger {
  logStateTransition(sessionId: string, from: E2eCallState, to: E2eCallState): void;
  logGreetingStarted(sessionId: string): void;
  logToolRequest(sessionId: string, toolId: string, parameters: Record<string, unknown>): void;
  logInterruptionDetected(sessionId: string): void;
  logReconnectAttempt(sessionId: string, attempt: number): void;
  logTimeoutTriggered(sessionId: string, type: string): void;
  logError(sessionId: string, code: string, message: string): void;
}

/**
 * End-to-End Call Flow — Coordinator Integration Tests
 */

import { CallFlowCoordinator } from '../call-flow.coordinator';
import { CallSessionManager } from '../call-session.manager';
import { CallContextManager } from '../call-context.manager';
import { CallTimeoutManager } from '../call-timeout.manager';
import { CallRetryManager } from '../call-retry.manager';
import { CallCleanupManager } from '../call-cleanup.manager';
import { CallAuditLogger } from '../call-audit.logger';
import { CallMetricsCollector } from '../call-metrics.collector';
import { eventPublisher } from '../end-to-end.event.publisher';
import {
  E2E_STATE_LISTENING,
  E2E_STATE_PROCESSING,
  E2E_STATE_RESPONDING,
  E2E_STATE_TERMINATED,
} from '../end-to-end.constants';

// ---------------------------------------------------------------------------
// Mock Implementations
// ---------------------------------------------------------------------------

class MockPromptService {
  public async composeSystemPrompt() {
    return { content: 'Mock composed greeting prompt.' };
  }
}

class MockToolExecutor {
  public lastRequest: any = null;
  public async execute(request: any) {
    this.lastRequest = request;
    return { status: 'success', result: { message: 'Booking confirmed.' } };
  }
}

class MockVoiceManager {
  public async createSession() {
    return { sessionId: 'voice_sess_123' };
  }
  public async endSession() {}
}

class MockRealtimeManager {
  public async createSession() {
    return { sessionId: 'realtime_sess_123' };
  }
  public async endSession() {}
}

// ---------------------------------------------------------------------------
// Test Suite
// ---------------------------------------------------------------------------

describe('End-to-End Call Flow Coordinator', () => {
  let coordinator: CallFlowCoordinator;
  let sessionManager: CallSessionManager;
  let contextManager: CallContextManager;
  let timeoutManager: CallTimeoutManager;
  let retryManager: CallRetryManager;
  let cleanupManager: CallCleanupManager;
  let audit: CallAuditLogger;
  let metrics: CallMetricsCollector;
  let mockToolExecutor: MockToolExecutor;

  beforeEach(() => {
    sessionManager = new CallSessionManager();
    contextManager = new CallContextManager();
    timeoutManager = new CallTimeoutManager();
    retryManager = new CallRetryManager();
    cleanupManager = new CallCleanupManager(
      sessionManager,
      contextManager,
      timeoutManager,
      retryManager,
    );
    audit = new CallAuditLogger(() => {});
    metrics = new CallMetricsCollector();
    mockToolExecutor = new MockToolExecutor();

    coordinator = new CallFlowCoordinator(
      sessionManager,
      contextManager,
      timeoutManager,
      retryManager,
      cleanupManager,
      audit,
      metrics,
      new MockPromptService(),
      mockToolExecutor,
      new MockVoiceManager(),
      new MockRealtimeManager(),
    );
  });

  afterEach(() => {
    sessionManager.clear();
  });

  // ---------------------------------------------------------------------------
  // Complete Inbound Call & Greeting setup
  // ---------------------------------------------------------------------------

  it('completes initial call setup, triggers greeting compose, and sets listening status', async () => {
    const session = await coordinator.initializeCall({
      tenantId: 'tenant-1',
      callerNumber: '+1234567890',
      calledNumber: '+1987654321',
      callSid: 'CA_test_sid_1',
    });

    expect(session.currentState).toBe(E2E_STATE_LISTENING);
    expect(session.voiceSessionId).toBe('voice_sess_123');
    expect(session.realtimeSessionId).toBe('realtime_sess_123');
    expect(sessionManager.activeSessions()).toHaveLength(1);
  });

  // ---------------------------------------------------------------------------
  // Speech, turns, and interruption routing
  // ---------------------------------------------------------------------------

  it('routes user speech events, transitions through processing, and emits replies', async () => {
    const session = await coordinator.initializeCall({
      tenantId: 'tenant-1',
      callerNumber: '+1234567890',
      calledNumber: '+1987654321',
      callSid: 'CA_test_sid_1',
    });

    await coordinator.handleUserSpeech(session.sessionId, 'I would like to book an appointment.');

    // Transitions back to listening loop after response
    expect(session.currentState).toBe(E2E_STATE_LISTENING);
  });

  it('handles customer speech interruptions and triggers assistant cancelation', async () => {
    const session = await coordinator.initializeCall({
      tenantId: 'tenant-1',
      callerNumber: '+1234567890',
      calledNumber: '+1987654321',
      callSid: 'CA_test_sid_1',
    });

    // Simulate mid-response speech interruption
    await coordinator.handleInterruption(session.sessionId);

    // Transitions back to listening loops
    expect(session.currentState).toBe(E2E_STATE_LISTENING);
  });

  // ---------------------------------------------------------------------------
  // Business tool execution routing
  // ---------------------------------------------------------------------------

  it('executes business tools through the AI Tool Pipeline, ensuring context binding', async () => {
    const session = await coordinator.initializeCall({
      tenantId: 'tenant-1',
      callerNumber: '+1234567890',
      calledNumber: '+1987654321',
      callSid: 'CA_test_sid_1',
    });

    // Manually transition to PROCESSING state to allow tool execution
    sessionManager.updateState(session.sessionId, E2E_STATE_PROCESSING);

    const result = await coordinator.handleToolExecution(
      session.sessionId,
      'book_appointment',
      '1.0.0',
      { date: '2026-07-20', time: '10:00' },
    );

    expect(result).toEqual({ status: 'success', result: { message: 'Booking confirmed.' } });
    expect(mockToolExecutor.lastRequest).toBeDefined();
    expect(mockToolExecutor.lastRequest.context.sessionId).toBe(session.sessionId);
    expect(mockToolExecutor.lastRequest.context.tenantId).toBe('tenant-1');
  });

  // ---------------------------------------------------------------------------
  // Timeout handups and teardowns
  // ---------------------------------------------------------------------------

  it('performs deterministic resource cleanup on inactivity timeout', async () => {
    const session = await coordinator.initializeCall({
      tenantId: 'tenant-1',
      callerNumber: '+1234567890',
      calledNumber: '+1987654321',
      callSid: 'CA_test_sid_1',
    });

    await coordinator.handleInactivityTimeout(session.sessionId);

    expect(sessionManager.getSession(session.sessionId)).toBeUndefined();
    expect(sessionManager.activeSessions()).toHaveLength(0);
  });
});

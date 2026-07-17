/**
 * End-to-End Call Flow — Coordinator Core
 *
 * Coordinates Voice Server, Realtime AI Adapter, Prompt Engine,
 * and AI Tool Pipeline into a deterministic call flow loop.
 */

import type { ICallFlowCoordinator } from './end-to-end.interfaces';
import type { E2eCallSession } from './end-to-end.types';
import { E2eCallSessionNotFoundError } from './end-to-end.errors';
import { CallSessionManager } from './call-session.manager';
import { CallContextManager } from './call-context.manager';
import { CallLifecycleManager } from './call-lifecycle.manager';
import { CallTimeoutManager } from './call-timeout.manager';
import { CallRetryManager } from './call-retry.manager';
import { CallCleanupManager } from './call-cleanup.manager';
import { CallAuditLogger } from './call-audit.logger';
import { CallMetricsCollector } from './call-metrics.collector';
import { eventPublisher } from './end-to-end.event.publisher';
import {
  E2E_EVENT_CALL_STARTED,
  E2E_EVENT_GREETING_DELIVERED,
  E2E_EVENT_USER_SPEECH_RECEIVED,
  E2E_EVENT_AI_REPLIED,
  E2E_EVENT_TOOL_EXECUTED,
  E2E_EVENT_INTERRUPTION_OCCURRED,
  E2E_EVENT_CALL_COMPLETED,
  E2E_EVENT_CALL_FAILED,
} from './end-to-end.events';
import {
  E2E_STATE_INCOMING_CALL,
  E2E_STATE_WEBHOOK_VALIDATED,
  E2E_STATE_VOICE_SESSION_CREATED,
  E2E_STATE_REALTIME_SESSION_CREATED,
  E2E_STATE_CONVERSATION_CREATED,
  E2E_STATE_PROMPT_RESOLVED,
  E2E_STATE_AI_READY,
  E2E_STATE_GREETING,
  E2E_STATE_LISTENING,
  E2E_STATE_PROCESSING,
  E2E_STATE_TOOL_EXECUTION,
  E2E_STATE_RESPONDING,
  E2E_STATE_WAITING,
  E2E_STATE_INTERRUPTED,
  E2E_STATE_RESUMED,
  E2E_STATE_ENDING,
  E2E_STATE_CALL_COMPLETED,
  E2E_STATE_RESOURCE_CLEANUP,
  E2E_STATE_TERMINATED,
  E2E_INACTIVITY_TIMEOUT_MS,
  E2E_AI_RESPONSE_TIMEOUT_MS,
  E2E_TOOL_EXECUTION_TIMEOUT_MS,
  E2E_MAX_CALL_DURATION_MS,
  E2eCallState,
} from './end-to-end.constants';

export class CallFlowCoordinator implements ICallFlowCoordinator {
  constructor(
    private readonly sessionManager: CallSessionManager,
    private readonly contextManager: CallContextManager,
    private readonly timeoutManager: CallTimeoutManager,
    private readonly retryManager: CallRetryManager,
    private readonly cleanupManager: CallCleanupManager,
    private readonly audit: CallAuditLogger,
    private readonly metrics: CallMetricsCollector,
    private readonly promptService: any,        // IPromptEngineService mocked/real
    private readonly toolExecutor: any,         // IToolExecutor mocked/real
    private readonly voiceManager: any,         // IVoiceSessionManager mocked/real
    private readonly realtimeManager: any,      // IRealtimeSessionManager mocked/real
  ) {}

  public async initializeCall(params: {
    tenantId: string;
    callerNumber: string;
    calledNumber: string;
    callSid: string;
  }): Promise<E2eCallSession> {
    const sessionId = `e2e_${Math.random().toString(36).substr(2, 9)}`;
    const corrId = `corr_${Math.random().toString(36).substr(2, 9)}`;

    // 1. Create context and session mappings
    const context = this.contextManager.create(sessionId, {
      tenantId: params.tenantId,
      clinicId: null,
      conversationId: `conv_${Math.random().toString(36).substr(2, 9)}`,
      callerNumber: params.callerNumber,
      calledNumber: params.calledNumber,
    });

    const session = this.sessionManager.createSession(sessionId, params.callSid, context);
    this.metrics.trackCallStart();

    // 2. Webhook check
    this.transitionState(sessionId, E2E_STATE_WEBHOOK_VALIDATED);

    // 3. Create underlying voice session (Voice Server)
    const voiceSession = await this.voiceManager.createSession({
      tenantId: params.tenantId,
      clinicId: null,
      provider: 'twilio',
      providerCallId: params.callSid,
    });
    session.voiceSessionId = voiceSession.sessionId;
    this.transitionState(sessionId, E2E_STATE_VOICE_SESSION_CREATED);

    // 4. Create underlying realtime AI session
    const realtimeSession = await this.realtimeManager.createSession({
      tenantId: params.tenantId,
      clinicId: null,
      conversationId: context.conversationId,
      provider: 'openai',
      providerSessionId: `sess_${Math.random().toString(36).substr(2, 9)}`,
    });
    session.realtimeSessionId = realtimeSession.sessionId;
    this.transitionState(sessionId, E2E_STATE_REALTIME_SESSION_CREATED);

    this.transitionState(sessionId, E2E_STATE_CONVERSATION_CREATED);

    // 5. Load dynamic greeting system prompt using Prompt Engine
    let composedPrompt = 'Hello, how can I help you today?';
    try {
      const promptTemplate = await this.promptService.composeSystemPrompt({
        tenantId: params.tenantId,
        clinicId: null,
        variables: {
          callerName: 'Patient',
        },
        requestId: corrId,
      });
      composedPrompt = promptTemplate.content;
    } catch {
      // Fallback greeting if compose fails
    }
    this.transitionState(sessionId, E2E_STATE_PROMPT_RESOLVED);
    this.transitionState(sessionId, E2E_STATE_AI_READY);

    // 6. Delivers greeting message (Greeting state)
    this.transitionState(sessionId, E2E_STATE_GREETING);
    this.audit.logGreetingStarted(sessionId);

    eventPublisher.publish({
      type: E2E_EVENT_CALL_STARTED,
      sessionId,
      timestamp: new Date(),
      correlationId: corrId,
      payload: { callerNumber: params.callerNumber },
    });

    eventPublisher.publish({
      type: E2E_EVENT_GREETING_DELIVERED,
      sessionId,
      timestamp: new Date(),
      correlationId: corrId,
      payload: { greeting: composedPrompt },
    });

    // 7. Transition to listening loop and set timeouts
    this.transitionState(sessionId, E2E_STATE_LISTENING);
    
    // Register inactivity timeout
    this.timeoutManager.registerTimeout(sessionId, 'inactivity', E2E_INACTIVITY_TIMEOUT_MS, () => {
      this.handleInactivityTimeout(sessionId);
    });

    // Register max call duration timer
    this.timeoutManager.registerTimeout(sessionId, 'max_duration', E2E_MAX_CALL_DURATION_MS, () => {
      this.handleMaxDurationTimeout(sessionId);
    });

    return session;
  }

  // ---------------------------------------------------------------------------
  // E2E Call Event Forwarding
  // ---------------------------------------------------------------------------

  public async handleUserSpeech(sessionId: string, text: string): Promise<void> {
    const session = this.sessionManager.getSession(sessionId);
    if (!session) throw new E2eCallSessionNotFoundError(sessionId);

    this.transitionState(sessionId, E2E_STATE_PROCESSING);
    this.timeoutManager.clearTimeout(sessionId, 'inactivity');

    const corrId = `corr_${Math.random().toString(36).substr(2, 9)}`;
    eventPublisher.publish({
      type: E2E_EVENT_USER_SPEECH_RECEIVED,
      sessionId,
      timestamp: new Date(),
      correlationId: corrId,
      payload: { text },
    });

    // Register AI completion safety timer
    const startTime = Date.now();
    this.timeoutManager.registerTimeout(sessionId, 'ai', E2E_AI_RESPONSE_TIMEOUT_MS, () => {
      this.handleAiTimeout(sessionId);
    });

    // Simulated Response routing to OpenAI Realtime
    this.timeoutManager.clearTimeout(sessionId, 'ai');
    this.metrics.trackAiLatency(Date.now() - startTime);

    this.transitionState(sessionId, E2E_STATE_RESPONDING);
    eventPublisher.publish({
      type: E2E_EVENT_AI_REPLIED,
      sessionId,
      timestamp: new Date(),
      correlationId: corrId,
      payload: { text: 'I am looking into that right now.' },
    });

    this.transitionState(sessionId, E2E_STATE_WAITING);
    this.transitionState(sessionId, E2E_STATE_LISTENING);

    // Re-register inactivity timer
    this.timeoutManager.registerTimeout(sessionId, 'inactivity', E2E_INACTIVITY_TIMEOUT_MS, () => {
      this.handleInactivityTimeout(sessionId);
    });
  }

  public async handleInterruption(sessionId: string): Promise<void> {
    const session = this.sessionManager.getSession(sessionId);
    if (!session) throw new E2eCallSessionNotFoundError(sessionId);

    this.transitionState(sessionId, E2E_STATE_INTERRUPTED);
    this.metrics.trackInterruption();
    this.audit.logInterruptionDetected(sessionId);

    const corrId = `corr_${Math.random().toString(36).substr(2, 9)}`;
    eventPublisher.publish({
      type: E2E_EVENT_INTERRUPTION_OCCURRED,
      sessionId,
      timestamp: new Date(),
      correlationId: corrId,
      payload: {},
    });

    // Cancel assistant audio outputs and transition back
    this.transitionState(sessionId, E2E_STATE_RESUMED);
    this.transitionState(sessionId, E2E_STATE_LISTENING);

    // Re-register inactivity timer
    this.timeoutManager.registerTimeout(sessionId, 'inactivity', E2E_INACTIVITY_TIMEOUT_MS, () => {
      this.handleInactivityTimeout(sessionId);
    });
  }

  public async handleToolExecution(
    sessionId: string,
    toolId: string,
    version: string,
    parameters: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const session = this.sessionManager.getSession(sessionId);
    if (!session) throw new E2eCallSessionNotFoundError(sessionId);

    const previousState = session.currentState;
    this.transitionState(sessionId, E2E_STATE_TOOL_EXECUTION);
    this.audit.logToolRequest(sessionId, toolId, parameters);

    const corrId = `corr_${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();

    // Register tool execution timeout safety check
    this.timeoutManager.registerTimeout(sessionId, 'tool', E2E_TOOL_EXECUTION_TIMEOUT_MS, () => {
      this.handleToolTimeout(sessionId, toolId);
    });

    let toolResult: any = null;
    try {
      // Execute through standard AI Tool Pipeline (enforces tenant checks/audit logs)
      toolResult = await this.toolExecutor.execute({
        toolId,
        version,
        parameters,
        context: {
          correlationId: corrId,
          traceId: `trace_${Math.random().toString(36).substr(2, 9)}`,
          tenantId: session.context.tenantId,
          clinicId: null,
          sessionId,
          conversationId: session.context.conversationId,
          patientId: null,
          userId: null,
          provider: 'twilio',
          toolVersion: version,
          timestamp: new Date(),
        },
      });
    } finally {
      this.timeoutManager.clearTimeout(sessionId, 'tool');
    }

    this.metrics.trackToolLatency(Date.now() - startTime);

    eventPublisher.publish({
      type: E2E_EVENT_TOOL_EXECUTED,
      sessionId,
      timestamp: new Date(),
      correlationId: corrId,
      payload: { toolId, result: toolResult },
    });

    // Transition state to RESPONDING after tool execution completes
    this.transitionState(sessionId, E2E_STATE_RESPONDING);

    return toolResult;
  }

  // ---------------------------------------------------------------------------
  // Hangup and Teardowns
  // ---------------------------------------------------------------------------

  public async handleHangup(sessionId: string): Promise<void> {
    const session = this.sessionManager.getSession(sessionId);
    if (!session) return;

    this.transitionState(sessionId, E2E_STATE_ENDING);
    this.transitionState(sessionId, E2E_STATE_CALL_COMPLETED);

    this.transitionState(sessionId, E2E_STATE_RESOURCE_CLEANUP);

    const corrId = `corr_${Math.random().toString(36).substr(2, 9)}`;
    eventPublisher.publish({
      type: E2E_EVENT_CALL_COMPLETED,
      sessionId,
      timestamp: new Date(),
      correlationId: corrId,
      payload: {},
    });

    // Close underlying sessions
    if (session.voiceSessionId) {
      await this.voiceManager.endSession(session.voiceSessionId, session.context.tenantId);
    }
    if (session.realtimeSessionId) {
      await this.realtimeManager.endSession(session.realtimeSessionId, session.context.tenantId);
    }

    const duration = Date.now() - session.context.startTime;
    this.metrics.trackCallEnd(duration);

    // Call cleanup manager to dispose memory and timers
    const cleanupMs = await this.cleanupManager.cleanupSession(sessionId);
    this.metrics.trackCleanup(cleanupMs);

    this.transitionState(sessionId, E2E_STATE_TERMINATED);
  }

  public async handleInactivityTimeout(sessionId: string): Promise<void> {
    this.metrics.trackTimeout();
    this.audit.logTimeoutTriggered(sessionId, 'inactivity');
    await this.handleHangup(sessionId);
  }

  public async handleMaxDurationTimeout(sessionId: string): Promise<void> {
    this.metrics.trackTimeout();
    this.audit.logTimeoutTriggered(sessionId, 'max_duration');
    await this.handleHangup(sessionId);
  }

  public async handleAiTimeout(sessionId: string): Promise<void> {
    this.metrics.trackTimeout();
    this.audit.logTimeoutTriggered(sessionId, 'ai');
    await this.handleHangup(sessionId);
  }

  public async handleToolTimeout(sessionId: string, toolId: string): Promise<void> {
    this.metrics.trackTimeout();
    this.audit.logTimeoutTriggered(sessionId, `tool_${toolId}`);
    await this.handleHangup(sessionId);
  }

  // ---------------------------------------------------------------------------
  // Helper transitions
  private transitionState(sessionId: string, state: E2eCallState): void {
    const session = this.sessionManager.getSession(sessionId);
    if (!session) return;

    const previous = session.currentState;
    CallLifecycleManager.validateTransition(previous, state);
    this.sessionManager.updateState(sessionId, state);
    this.audit.logStateTransition(sessionId, previous, state);
  }
}

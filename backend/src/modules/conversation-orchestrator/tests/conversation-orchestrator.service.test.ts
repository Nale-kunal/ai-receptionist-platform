import { ConversationOrchestratorService } from '../conversation-orchestrator.service';
import { TurnManager } from '../turn.manager';
import { TranscriptManager } from '../transcript.manager';
import { ContextSynchronizer } from '../context.synchronizer';
import { ConversationRecoveryManager } from '../conversation-recovery.manager';
import { ConversationSnapshotManager } from '../conversation-snapshot.manager';
import { RuntimeResourceManager } from '../runtime-resource.manager';
import { InProcessOrchestratorEventPublisher } from '../conversation-orchestrator-event.publisher';
import { OrchestratorMetricsCollector } from '../conversation-orchestrator.metrics.collector';
import type { IOrchestratorAuditLogger } from '../conversation-orchestrator.interfaces';
import type { EventCorrelation } from '../conversation-orchestrator.types';

describe('ConversationOrchestratorService Integration', () => {
  let service: ConversationOrchestratorService;
  let auditLogger: jest.Mocked<IOrchestratorAuditLogger>;
  let publisher: InProcessOrchestratorEventPublisher;
  let correlation: EventCorrelation;

  beforeEach(() => {
    auditLogger = {
      logSessionCreated: jest.fn().mockResolvedValue(undefined),
      logSessionClosed: jest.fn().mockResolvedValue(undefined),
      logStateTransition: jest.fn().mockResolvedValue(undefined),
      logTimeoutTriggered: jest.fn().mockResolvedValue(undefined),
      logInterruptionDetected: jest.fn().mockResolvedValue(undefined),
      logSnapshotCreated: jest.fn().mockResolvedValue(undefined),
      logSessionRecovered: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<IOrchestratorAuditLogger>;

    publisher = new InProcessOrchestratorEventPublisher();

    const snapshotManager = new ConversationSnapshotManager();
    const recoveryManager = new ConversationRecoveryManager(snapshotManager, { maxRecoveryTtlMs: 200 });

    service = new ConversationOrchestratorService(
      new TurnManager(),
      new TranscriptManager(),
      new ContextSynchronizer(),
      recoveryManager,
      snapshotManager,
      new RuntimeResourceManager(),
      publisher,
      new OrchestratorMetricsCollector(),
      auditLogger,
      {
        rateLimitConversationsPerMinute: 10,
        aiTimeoutMs: 50,
        inactivityTimeoutMs: 50,
      }
    );

    correlation = {
      correlationId: 'c1',
      traceId: 'tr1',
      tenantId: 't1',
      sessionId: '',
      conversationId: '33333333-3333-3333-3333-333333333333',
      timestamp: new Date(),
    };
  });

  it('runs initial auto transitions and logs audit transitions successfully', async () => {
    const session = await service.createSession({
      tenantId: 't1',
      clinicId: null,
      conversationId: correlation.conversationId,
      correlation,
    });

    expect(session.state).toBe('INITIALIZING');
    expect(auditLogger.logSessionCreated).toHaveBeenCalled();

    const updated = await service.updateState(session.sessionId, 't1', 'GREETING', correlation);
    expect(updated.state).toBe('GREETING');
    expect(auditLogger.logStateTransition).toHaveBeenCalledWith(
      session.sessionId,
      't1',
      'INITIALIZING',
      'GREETING',
      correlation
    );
  });

  it('handles barge-in interruptions and recovers checkpoints', async () => {
    const session = await service.createSession({
      tenantId: 't1',
      clinicId: null,
      conversationId: correlation.conversationId,
      correlation,
    });

    await service.updateState(session.sessionId, 't1', 'GREETING', correlation);
    await service.updateState(session.sessionId, 't1', 'LISTENING', correlation);
    await service.updateState(session.sessionId, 't1', 'PROCESSING', correlation);
    await service.updateState(session.sessionId, 't1', 'RESPONDING', correlation);

    const interrupted = await service.handleInterruption(session.sessionId, 't1', 500, correlation);
    expect(interrupted.state).toBe('LISTENING');
    expect(auditLogger.logInterruptionDetected).toHaveBeenCalled();
  });

  it('restores reconnect checkpoints gracefully on triggerReconnectRecovery', async () => {
    const session = await service.createSession({
      tenantId: 't1',
      clinicId: null,
      conversationId: correlation.conversationId,
      correlation,
    });

    await service.updateState(session.sessionId, 't1', 'GREETING', correlation);
    await service.updateState(session.sessionId, 't1', 'LISTENING', correlation);

    // Call reconnect recovery trigger
    const recovered = await service.triggerReconnectRecovery(session.sessionId, 't1', correlation);
    expect(recovered.state).toBe('RESUMED');
    expect(auditLogger.logSessionRecovered).toHaveBeenCalled();
  });

  it('triggers inactivity timeouts gracefully publishing failure event', (done) => {
    let failedEventReceived = false;
    publisher.subscribe('conversation.failed', () => {
      failedEventReceived = true;
    });

    service.createSession({
      tenantId: 't1',
      clinicId: null,
      conversationId: correlation.conversationId,
      correlation,
    }).then(async (session) => {
      await service.updateState(session.sessionId, 't1', 'GREETING', correlation);
      await service.updateState(session.sessionId, 't1', 'LISTENING', correlation);

      setTimeout(async () => {
        try {
          expect(failedEventReceived).toBe(true);
          expect(auditLogger.logTimeoutTriggered).toHaveBeenCalled();
          done();
        } catch (err) {
          done(err);
        }
      }, 70);
    });
  });
});

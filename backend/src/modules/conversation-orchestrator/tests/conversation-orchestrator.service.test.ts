import { ConversationOrchestratorService } from '../services/conversation-orchestrator.service';
import { TurnManager } from '../services/turn.manager';
import { TranscriptManager } from '../services/transcript.manager';
import { ContextSynchronizer } from '../services/context.synchronizer';
import { InProcessOrchestratorEventPublisher } from '../events/conversation-orchestrator-event.publisher';
import type { IOrchestratorMetricsCollector } from '../interfaces/conversation-orchestrator.interfaces';

describe('ConversationOrchestratorService', () => {
  let service: ConversationOrchestratorService;
  let metrics: jest.Mocked<IOrchestratorMetricsCollector>;
  let publisher: InProcessOrchestratorEventPublisher;

  beforeEach(() => {
    metrics = {
      trackSessionStart: jest.fn(),
      trackSessionEnd: jest.fn(),
      trackInterruption: jest.fn(),
      trackResume: jest.fn(),
      trackResponse: jest.fn(),
      trackToolRequest: jest.fn(),
      trackReconnect: jest.fn(),
      trackTimeout: jest.fn(),
      trackLatency: jest.fn(),
      trackTranscriptSize: jest.fn(),
      getMetrics: jest.fn(),
    } as unknown as jest.Mocked<IOrchestratorMetricsCollector>;

    publisher = new InProcessOrchestratorEventPublisher();

    service = new ConversationOrchestratorService(
      new TurnManager(),
      new TranscriptManager(),
      new ContextSynchronizer(),
      publisher,
      metrics,
      {
        rateLimitConversationsPerMinute: 10,
        aiTimeoutMs: 50,
        inactivityTimeoutMs: 50,
      }
    );
  });

  it('runs initial auto transitions and updates states correctly', async () => {
    const session = await service.createSession({
      tenantId: 't1',
      clinicId: null,
      conversationId: '33333333-3333-3333-3333-333333333333',
    });

    expect(session.state).toBe('INITIALIZING');
    
    const updated = await service.updateState(session.sessionId, 't1', 'GREETING');
    expect(updated.state).toBe('GREETING');
  });

  it('handles barge-in interruptions and restores lifecycle state', async () => {
    const session = await service.createSession({
      tenantId: 't1',
      clinicId: null,
      conversationId: '33333333-3333-3333-3333-333333333333',
    });

    await service.updateState(session.sessionId, 't1', 'GREETING');
    await service.updateState(session.sessionId, 't1', 'LISTENING');
    await service.updateState(session.sessionId, 't1', 'PROCESSING');
    await service.updateState(session.sessionId, 't1', 'RESPONDING');

    const interrupted = await service.handleInterruption(session.sessionId, 't1', 500);
    // handleInterruption transitions RESPONDING -> INTERRUPTED -> (auto) RESUMED -> (auto) LISTENING
    expect(interrupted.state).toBe('LISTENING');
    expect(metrics.trackInterruption).toHaveBeenCalled();
  });

  it('clears timers and clean resources on terminal state', async () => {
    const session = await service.createSession({
      tenantId: 't1',
      clinicId: null,
      conversationId: '33333333-3333-3333-3333-333333333333',
    });

    await service.updateState(session.sessionId, 't1', 'GREETING');
    await service.updateState(session.sessionId, 't1', 'LISTENING');
    await service.updateState(session.sessionId, 't1', 'PROCESSING');
    await service.updateState(session.sessionId, 't1', 'RESPONDING');
    await service.updateState(session.sessionId, 't1', 'WAITING');
    await service.updateState(session.sessionId, 't1', 'ENDING');
    
    const completed = await service.updateState(session.sessionId, 't1', 'COMPLETED');
    expect(completed.state).toBe('COMPLETED');

    // Should be deleted from active service memory map
    await expect(service.getSession(session.sessionId, 't1')).rejects.toThrow();
  });

  it('triggers inactivity timeouts gracefully', (done) => {
    let failedEventReceived = false;
    publisher.subscribe('conversation.failed', () => {
      failedEventReceived = true;
    });

    service.createSession({
      tenantId: 't1',
      clinicId: null,
      conversationId: '33333333-3333-3333-3333-333333333333',
    }).then(async (session) => {
      await service.updateState(session.sessionId, 't1', 'GREETING');
      await service.updateState(session.sessionId, 't1', 'LISTENING');

      // Wait for inactivity timer
      setTimeout(async () => {
        try {
          expect(failedEventReceived).toBe(true);
          expect(metrics.trackTimeout).toHaveBeenCalled();
          done();
        } catch (err) {
          done(err);
        }
      }, 70);
    });
  });
});

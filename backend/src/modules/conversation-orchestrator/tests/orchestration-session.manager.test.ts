import { ConversationOrchestratorService } from '../services/conversation-orchestrator.service';
import { TurnManager } from '../services/turn.manager';
import { TranscriptManager } from '../services/transcript.manager';
import { ContextSynchronizer } from '../services/context.synchronizer';
import { InProcessOrchestratorEventPublisher } from '../events/conversation-orchestrator-event.publisher';
import type { IOrchestratorMetricsCollector } from '../interfaces/conversation-orchestrator.interfaces';

describe('OrchestrationSessionManager', () => {
  let service: ConversationOrchestratorService;
  let metrics: jest.Mocked<IOrchestratorMetricsCollector>;

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

    service = new ConversationOrchestratorService(
      new TurnManager(),
      new TranscriptManager(),
      new ContextSynchronizer(),
      new InProcessOrchestratorEventPublisher(),
      metrics,
      {
        rateLimitConversationsPerMinute: 3,
        aiTimeoutMs: 500,
        inactivityTimeoutMs: 500,
      }
    );
  });

  it('creates and updates session state', async () => {
    const session = await service.createSession({
      tenantId: 'tenant-1',
      clinicId: null,
      conversationId: '22222222-2222-2222-2222-222222222222',
    });

    expect(session.sessionId).toContain('orch_ses_');
    expect(session.state).toBe('INITIALIZING');
    expect(metrics.trackSessionStart).toHaveBeenCalledWith('tenant-1');
  });

  it('enforces creation rate limits', () => {
    expect(service.rateLimitCheck('tenant-1')).toBe(true);
    service.createSession({ tenantId: 'tenant-1', clinicId: null, conversationId: '22222222-2222-2222-2222-222222222222' });
    service.createSession({ tenantId: 'tenant-1', clinicId: null, conversationId: '22222222-2222-2222-2222-222222222222' });
    service.createSession({ tenantId: 'tenant-1', clinicId: null, conversationId: '22222222-2222-2222-2222-222222222222' });

    expect(service.rateLimitCheck('tenant-1')).toBe(false);
  });
});

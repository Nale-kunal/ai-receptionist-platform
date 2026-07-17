import { InProcessOrchestratorEventPublisher } from '../conversation-orchestrator-event.publisher';
import type { OrchestratorDomainEvent } from '../conversation-orchestrator.events';
import type { EventCorrelation } from '../conversation-orchestrator.types';

describe('InProcessOrchestratorEventPublisher Priority Queue', () => {
  let publisher: InProcessOrchestratorEventPublisher;
  let correlation: EventCorrelation;

  beforeEach(() => {
    publisher = new InProcessOrchestratorEventPublisher();
    correlation = {
      correlationId: 'c1',
      traceId: 'tr1',
      tenantId: 't1',
      sessionId: 's1',
      conversationId: 'conv-1',
      timestamp: new Date(),
    };
  });

  it('delivers events in priority order (high to low)', async () => {
    const receivedOrder: string[] = [];

    // Subscribe to multiple event types
    publisher.subscribe('conversation.completed', (evt) => {
      receivedOrder.push(evt.type);
    });
    publisher.subscribe('conversation.failed', (evt) => {
      receivedOrder.push(evt.type);
    });
    publisher.subscribe('conversation.interrupted', (evt) => {
      receivedOrder.push(evt.type);
    });

    // Publish in out-of-order sequence (lowest priority first)
    const p1 = publisher.publish({
      type: 'conversation.completed',
      correlation,
      payload: { sessionId: 's1', tenantId: 't1', durationMs: 1000 },
    });
    const p2 = publisher.publish({
      type: 'conversation.interrupted',
      correlation,
      payload: { sessionId: 's1', tenantId: 't1', audioOffsetMs: 200 },
    });
    const p3 = publisher.publish({
      type: 'conversation.failed',
      correlation,
      payload: { sessionId: 's1', tenantId: 't1', errorCode: 'ERR', errorMessage: 'Fail' },
    });

    await Promise.all([p1, p2, p3]);

    // Priority hierarchy: conversation.failed (1) -> conversation.interrupted (3) -> conversation.completed (7)
    expect(receivedOrder).toEqual([
      'conversation.failed',
      'conversation.interrupted',
      'conversation.completed',
    ]);
  });
});

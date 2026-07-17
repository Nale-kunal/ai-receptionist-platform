import { ConversationSnapshotManager } from '../conversation-snapshot.manager';
import type { EventCorrelation } from '../conversation-orchestrator.types';

describe('ConversationSnapshotManager', () => {
  let manager: ConversationSnapshotManager;
  let correlation: EventCorrelation;

  beforeEach(() => {
    manager = new ConversationSnapshotManager();
    correlation = {
      correlationId: 'c1',
      traceId: 'tr1',
      tenantId: 't1',
      sessionId: 's1',
      conversationId: 'conv-1',
      timestamp: new Date(),
    };
  });

  it('takes snapshot copy successfully ensuring context parameter immutability', () => {
    const context = {
      tenantId: 't1',
      clinicId: null,
      patientId: null,
      doctorId: null,
      appointmentId: null,
      conversationId: 'conv-1',
      aiSessionId: null,
      promptVersion: null,
      variables: { testKey: 'origVal' },
      providerMetadata: {},
    };

    const snapshot = manager.takeSnapshot('s1', 'LISTENING', context, [], correlation);
    expect(snapshot.context.variables.testKey).toBe('origVal');

    // Mutate original context
    context.variables.testKey = 'mutated';
    
    // Expect snapshot to remain unchanged
    const latest = manager.getLatestSnapshot('s1');
    expect(latest?.context.variables.testKey).toBe('origVal');
  });
});

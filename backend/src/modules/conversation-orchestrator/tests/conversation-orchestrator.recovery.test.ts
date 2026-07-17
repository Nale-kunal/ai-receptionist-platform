import { ConversationRecoveryManager } from '../conversation-recovery.manager';
import { ConversationSnapshotManager } from '../conversation-snapshot.manager';
import type { EventCorrelation } from '../conversation-orchestrator.types';

describe('ConversationRecoveryManager', () => {
  let recovery: ConversationRecoveryManager;
  let snapshotManager: ConversationSnapshotManager;
  let correlation: EventCorrelation;

  beforeEach(() => {
    snapshotManager = new ConversationSnapshotManager();
    recovery = new ConversationRecoveryManager(snapshotManager, { maxRecoveryTtlMs: 200 });
    correlation = {
      correlationId: 'c1',
      traceId: 'tr1',
      tenantId: 't1',
      sessionId: 's1',
      conversationId: 'conv-1',
      timestamp: new Date(),
    };
  });

  it('checkpoints and recovers session snapshot successfully', async () => {
    snapshotManager.takeSnapshot('s1', 'LISTENING', {
      tenantId: 't1',
      clinicId: null,
      patientId: null,
      doctorId: null,
      appointmentId: null,
      conversationId: 'conv-1',
      aiSessionId: null,
      promptVersion: null,
      variables: {},
      providerMetadata: {},
    }, [], correlation);

    await recovery.checkpointSession('s1', correlation);
    const recovered = await recovery.recoverSession('s1', correlation);
    expect(recovered).not.toBeNull();
    expect(recovered?.state).toBe('LISTENING');
  });

  it('rejects expired recovery checkpoints', async () => {
    snapshotManager.takeSnapshot('s1', 'LISTENING', {
      tenantId: 't1',
      clinicId: null,
      patientId: null,
      doctorId: null,
      appointmentId: null,
      conversationId: 'conv-1',
      aiSessionId: null,
      promptVersion: null,
      variables: {},
      providerMetadata: {},
    }, [], correlation);

    await recovery.checkpointSession('s1', correlation);

    // Wait for TTL expiration
    await new Promise((resolve) => setTimeout(resolve, 250));

    const recovered = await recovery.recoverSession('s1', correlation);
    expect(recovered).toBeNull();
  });
});

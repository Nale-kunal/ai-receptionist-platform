import type { IConversationSnapshotManager } from './conversation-orchestrator.interfaces';
import type {
  ConversationSnapshot,
  OrchestrationContext,
  OrchestrationTurn,
  EventCorrelation,
} from './conversation-orchestrator.types';
import type { OrchestrationState } from './conversation-orchestrator.constants';

export class ConversationSnapshotManager implements IConversationSnapshotManager {
  private readonly snapshots: Map<string, ConversationSnapshot[]> = new Map();

  public takeSnapshot(
    sessionId: string,
    state: OrchestrationState,
    context: OrchestrationContext,
    turns: OrchestrationTurn[],
    correlation: EventCorrelation
  ): ConversationSnapshot {
    const list = this.snapshots.get(sessionId) ?? [];

    // Create deep copy of context and turns to enforce immutability
    const contextCopy: OrchestrationContext = {
      tenantId: context.tenantId,
      clinicId: context.clinicId,
      patientId: context.patientId,
      doctorId: context.doctorId,
      appointmentId: context.appointmentId,
      conversationId: context.conversationId,
      aiSessionId: context.aiSessionId,
      promptVersion: context.promptVersion,
      variables: { ...context.variables },
      providerMetadata: { ...context.providerMetadata },
    };

    const turnsCopy: OrchestrationTurn[] = turns.map((t) => ({
      turnId: t.turnId,
      speaker: t.speaker,
      status: t.status,
      transcript: t.transcript,
      startedAt: new Date(t.startedAt.getTime()),
      completedAt: t.completedAt ? new Date(t.completedAt.getTime()) : null,
    }));

    const snapshot: ConversationSnapshot = {
      snapshotId: `snap_${Math.random().toString(36).substring(2, 10)}`,
      sessionId,
      tenantId: context.tenantId,
      state,
      context: contextCopy,
      turns: turnsCopy,
      correlation,
      createdAt: new Date(),
    };

    list.push(snapshot);
    this.snapshots.set(sessionId, list);

    return snapshot;
  }

  public getLatestSnapshot(sessionId: string): ConversationSnapshot | null {
    const list = this.snapshots.get(sessionId) ?? [];
    if (list.length === 0) return null;
    return list[list.length - 1];
  }

  public clearSessionSnapshots(sessionId: string): void {
    this.snapshots.delete(sessionId);
  }
}

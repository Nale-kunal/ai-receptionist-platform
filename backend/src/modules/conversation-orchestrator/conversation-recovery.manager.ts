import type { IConversationRecoveryManager, IConversationSnapshotManager } from './conversation-orchestrator.interfaces';
import type { ConversationSnapshot, EventCorrelation } from './conversation-orchestrator.types';

export class ConversationRecoveryManager implements IConversationRecoveryManager {
  private readonly recoveryCheckpoints: Map<string, ConversationSnapshot> = new Map();

  constructor(
    private readonly snapshotManager: IConversationSnapshotManager,
    private readonly config: { maxRecoveryTtlMs: number }
  ) {}

  public async checkpointSession(sessionId: string, correlation: EventCorrelation): Promise<void> {
    const snapshot = this.snapshotManager.getLatestSnapshot(sessionId);
    if (snapshot) {
      this.recoveryCheckpoints.set(sessionId, snapshot);
    }
  }

  public async recoverSession(sessionId: string, correlation: EventCorrelation): Promise<ConversationSnapshot | null> {
    const checkpoint = this.recoveryCheckpoints.get(sessionId);
    if (!checkpoint) {
      return null;
    }

    // Enforce recovery expiration check
    const age = Date.now() - checkpoint.createdAt.getTime();
    if (age > this.config.maxRecoveryTtlMs) {
      this.recoveryCheckpoints.delete(sessionId);
      return null;
    }

    return checkpoint;
  }

  public clearRecoveryContext(sessionId: string): void {
    this.recoveryCheckpoints.delete(sessionId);
  }
}

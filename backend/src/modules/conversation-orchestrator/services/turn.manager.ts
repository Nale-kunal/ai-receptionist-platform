import type { ITurnManager } from '../interfaces/conversation-orchestrator.interfaces';
import type { OrchestrationTurn } from '../types/conversation-orchestrator.types';
import { TurnConflictError } from '../errors/conversation-orchestrator.errors';

export class TurnManager implements ITurnManager {
  private readonly sessionTurns: Map<string, OrchestrationTurn[]> = new Map();

  public startUserTurn(sessionId: string): OrchestrationTurn {
    const turns = this.sessionTurns.get(sessionId) ?? [];
    const current = this.getActiveTurn(turns);
    
    if (current) {
      if (current.speaker === 'user') {
        return current; // already in user turn, no-op
      }
      throw new TurnConflictError('Cannot start user turn while assistant turn is active.');
    }

    const nextTurn: OrchestrationTurn = {
      turnId: `turn_${this.generateId()}`,
      speaker: 'user',
      status: 'started',
      transcript: '',
      startedAt: new Date(),
      completedAt: null,
    };

    turns.push(nextTurn);
    this.sessionTurns.set(sessionId, turns);
    return nextTurn;
  }

  public completeUserTurn(sessionId: string, text: string): OrchestrationTurn {
    const turns = this.sessionTurns.get(sessionId) ?? [];
    const active = this.getActiveTurn(turns);

    if (!active || active.speaker !== 'user') {
      throw new TurnConflictError('No active user turn to complete.');
    }

    active.status = 'completed';
    active.transcript = text;
    active.completedAt = new Date();

    return active;
  }

  public startAssistantTurn(sessionId: string): OrchestrationTurn {
    const turns = this.sessionTurns.get(sessionId) ?? [];
    const current = this.getActiveTurn(turns);

    if (current) {
      throw new TurnConflictError(`Cannot start assistant turn while active ${current.speaker} turn exists.`);
    }

    const nextTurn: OrchestrationTurn = {
      turnId: `turn_${this.generateId()}`,
      speaker: 'assistant',
      status: 'started',
      transcript: '',
      startedAt: new Date(),
      completedAt: null,
    };

    turns.push(nextTurn);
    this.sessionTurns.set(sessionId, turns);
    return nextTurn;
  }

  public completeAssistantTurn(sessionId: string, text: string): OrchestrationTurn {
    const turns = this.sessionTurns.get(sessionId) ?? [];
    const active = this.getActiveTurn(turns);

    if (!active || active.speaker !== 'assistant') {
      throw new TurnConflictError('No active assistant turn to complete.');
    }

    active.status = 'completed';
    active.transcript = text;
    active.completedAt = new Date();

    return active;
  }

  public interruptCurrentTurn(sessionId: string): OrchestrationTurn | null {
    const turns = this.sessionTurns.get(sessionId) ?? [];
    const active = this.getActiveTurn(turns);

    if (!active) {
      return null;
    }

    active.status = 'interrupted';
    active.completedAt = new Date();
    return active;
  }

  public getCurrentTurn(sessionId: string): OrchestrationTurn | null {
    const turns = this.sessionTurns.get(sessionId) ?? [];
    return this.getActiveTurn(turns);
  }

  public clearSessionTurns(sessionId: string): void {
    this.sessionTurns.delete(sessionId);
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private getActiveTurn(turns: OrchestrationTurn[]): OrchestrationTurn | null {
    if (turns.length === 0) return null;
    const last = turns[turns.length - 1];
    return last.status === 'started' ? last : null;
  }

  private generateId(): string {
    return Math.random().toString(36).substring(2, 10);
  }
}

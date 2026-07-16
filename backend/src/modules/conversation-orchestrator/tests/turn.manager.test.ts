import { TurnManager } from '../services/turn.manager';
import { TurnConflictError } from '../errors/conversation-orchestrator.errors';

describe('TurnManager', () => {
  let turnManager: TurnManager;

  beforeEach(() => {
    turnManager = new TurnManager();
  });

  it('allows starting and completing user turns', () => {
    const turn = turnManager.startUserTurn('session-1');
    expect(turn.speaker).toBe('user');
    expect(turn.status).toBe('started');

    const completed = turnManager.completeUserTurn('session-1', 'User transcript');
    expect(completed.status).toBe('completed');
    expect(completed.transcript).toBe('User transcript');
  });

  it('rejects concurrent assistant turn start when user turn is active', () => {
    turnManager.startUserTurn('session-1');
    expect(() => {
      turnManager.startAssistantTurn('session-1');
    }).toThrow(TurnConflictError);
  });

  it('allows turn interruption', () => {
    turnManager.startAssistantTurn('session-1');
    const interrupted = turnManager.interruptCurrentTurn('session-1');
    expect(interrupted).not.toBeNull();
    expect(interrupted?.status).toBe('interrupted');
  });
});

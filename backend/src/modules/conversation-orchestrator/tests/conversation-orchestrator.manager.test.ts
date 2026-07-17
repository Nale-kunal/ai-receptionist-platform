import { TurnManager } from '../turn.manager';
import { TurnConflictError } from '../conversation-orchestrator.errors';
import type { EventCorrelation } from '../conversation-orchestrator.types';

describe('TurnManager', () => {
  let turnManager: TurnManager;
  let correlation: EventCorrelation;

  beforeEach(() => {
    turnManager = new TurnManager();
    correlation = {
      correlationId: 'c1',
      traceId: 'tr1',
      tenantId: 't1',
      sessionId: 's1',
      conversationId: 'conv-1',
      timestamp: new Date(),
    };
  });

  it('allows starting and completing user turns', () => {
    const turn = turnManager.startUserTurn('s1', correlation);
    expect(turn.speaker).toBe('user');
    expect(turn.status).toBe('started');

    const completed = turnManager.completeUserTurn('s1', 'User text', correlation);
    expect(completed.status).toBe('completed');
    expect(completed.transcript).toBe('User text');
  });

  it('rejects concurrent assistant turn start when user turn is active', () => {
    turnManager.startUserTurn('s1', correlation);
    expect(() => {
      turnManager.startAssistantTurn('s1', correlation);
    }).toThrow(TurnConflictError);
  });

  it('allows turn interruption', () => {
    turnManager.startAssistantTurn('s1', correlation);
    const interrupted = turnManager.interruptCurrentTurn('s1', correlation);
    expect(interrupted).not.toBeNull();
    expect(interrupted?.status).toBe('interrupted');
  });
});

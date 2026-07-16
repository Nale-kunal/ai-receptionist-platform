import { OrchestrationSessionStateMachine } from '../services/orchestration-session.state-machine';
import { OrchestratorInvalidStateTransitionError } from '../errors/conversation-orchestrator.errors';

describe('OrchestrationSessionStateMachine', () => {
  it('allows self transition (no-op)', () => {
    expect(() => {
      OrchestrationSessionStateMachine.validateTransition('LISTENING', 'LISTENING');
    }).not.toThrow();
  });

  it('allows valid state transitions', () => {
    expect(() => {
      OrchestrationSessionStateMachine.validateTransition('CREATED', 'INITIALIZING');
      OrchestrationSessionStateMachine.validateTransition('INITIALIZING', 'GREETING');
      OrchestrationSessionStateMachine.validateTransition('GREETING', 'LISTENING');
      OrchestrationSessionStateMachine.validateTransition('LISTENING', 'PROCESSING');
      OrchestrationSessionStateMachine.validateTransition('PROCESSING', 'RESPONDING');
      OrchestrationSessionStateMachine.validateTransition('RESPONDING', 'WAITING');
    }).not.toThrow();
  });

  it('allows transition to FAILED/ENDING from most active states', () => {
    expect(() => {
      OrchestrationSessionStateMachine.validateTransition('CREATED', 'FAILED');
      OrchestrationSessionStateMachine.validateTransition('INITIALIZING', 'ENDING');
      OrchestrationSessionStateMachine.validateTransition('RESPONDING', 'FAILED');
    }).not.toThrow();
  });

  it('rejects invalid state transitions with OrchestratorInvalidStateTransitionError', () => {
    expect(() => {
      OrchestrationSessionStateMachine.validateTransition('CREATED', 'RESPONDING');
    }).toThrow(OrchestratorInvalidStateTransitionError);

    expect(() => {
      OrchestrationSessionStateMachine.validateTransition('COMPLETED', 'INITIALIZING');
    }).toThrow(OrchestratorInvalidStateTransitionError);
  });

  it('identifies terminal states correctly', () => {
    expect(OrchestrationSessionStateMachine.isTerminal('COMPLETED')).toBe(true);
    expect(OrchestrationSessionStateMachine.isTerminal('FAILED')).toBe(true);
    expect(OrchestrationSessionStateMachine.isTerminal('LISTENING')).toBe(false);
  });
});

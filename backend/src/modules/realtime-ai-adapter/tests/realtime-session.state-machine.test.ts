import { RealtimeSessionStateMachine } from '../services/realtime-session.state-machine';
import { RealtimeInvalidStateTransitionError } from '../errors/realtime-ai.errors';

describe('RealtimeSessionStateMachine', () => {
  it('allows self transition (no-op)', () => {
    expect(() => {
      RealtimeSessionStateMachine.validateTransition('CONNECTED', 'CONNECTED');
    }).not.toThrow();
  });

  it('allows valid state transitions', () => {
    expect(() => {
      RealtimeSessionStateMachine.validateTransition('CREATED', 'CONNECTING');
      RealtimeSessionStateMachine.validateTransition('CONNECTING', 'CONNECTED');
      RealtimeSessionStateMachine.validateTransition('CONNECTED', 'STREAMING');
      RealtimeSessionStateMachine.validateTransition('STREAMING', 'PAUSED');
      RealtimeSessionStateMachine.validateTransition('PAUSED', 'STREAMING');
      RealtimeSessionStateMachine.validateTransition('STREAMING', 'ENDED');
    }).not.toThrow();
  });

  it('allows transition to FAILED/ENDED from most active states', () => {
    expect(() => {
      RealtimeSessionStateMachine.validateTransition('CREATED', 'FAILED');
      RealtimeSessionStateMachine.validateTransition('CONNECTING', 'FAILED');
      RealtimeSessionStateMachine.validateTransition('CONNECTED', 'FAILED');
      RealtimeSessionStateMachine.validateTransition('STREAMING', 'FAILED');
      RealtimeSessionStateMachine.validateTransition('PAUSED', 'ENDED');
    }).not.toThrow();
  });

  it('rejects invalid state transitions with RealtimeInvalidStateTransitionError', () => {
    expect(() => {
      RealtimeSessionStateMachine.validateTransition('CREATED', 'STREAMING');
    }).toThrow(RealtimeInvalidStateTransitionError);

    expect(() => {
      RealtimeSessionStateMachine.validateTransition('ENDED', 'CONNECTED');
    }).toThrow(RealtimeInvalidStateTransitionError);

    expect(() => {
      RealtimeSessionStateMachine.validateTransition('FAILED', 'CREATED');
    }).toThrow(RealtimeInvalidStateTransitionError);
  });

  it('identifies terminal states correctly', () => {
    expect(RealtimeSessionStateMachine.isTerminal('ENDED')).toBe(true);
    expect(RealtimeSessionStateMachine.isTerminal('FAILED')).toBe(true);
    expect(RealtimeSessionStateMachine.isTerminal('STREAMING')).toBe(false);
  });
});

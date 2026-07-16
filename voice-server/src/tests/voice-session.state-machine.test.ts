import { VoiceSessionStateMachine } from '../sessions/voice-session.state-machine';
import { InvalidStateTransitionError } from '../errors/voice-server.errors';

describe('VoiceSessionStateMachine', () => {
  it('allows self transition (no-op)', () => {
    expect(() => {
      VoiceSessionStateMachine.validateTransition('CONNECTED', 'CONNECTED');
    }).not.toThrow();
  });

  it('allows valid state transition sequences', () => {
    expect(() => {
      VoiceSessionStateMachine.validateTransition('CREATED', 'CONNECTING');
      VoiceSessionStateMachine.validateTransition('CONNECTING', 'CONNECTED');
      VoiceSessionStateMachine.validateTransition('CONNECTED', 'STREAMING');
      VoiceSessionStateMachine.validateTransition('STREAMING', 'PAUSED');
      VoiceSessionStateMachine.validateTransition('PAUSED', 'RESUMED');
      VoiceSessionStateMachine.validateTransition('RESUMED', 'STREAMING');
      VoiceSessionStateMachine.validateTransition('STREAMING', 'DISCONNECTING');
      VoiceSessionStateMachine.validateTransition('DISCONNECTING', 'ENDED');
    }).not.toThrow();
  });

  it('allows transition to FAILED from most states', () => {
    expect(() => {
      VoiceSessionStateMachine.validateTransition('CREATED', 'FAILED');
      VoiceSessionStateMachine.validateTransition('CONNECTING', 'FAILED');
      VoiceSessionStateMachine.validateTransition('CONNECTED', 'FAILED');
      VoiceSessionStateMachine.validateTransition('STREAMING', 'FAILED');
    }).not.toThrow();
  });

  it('rejects illegal transitions throwing InvalidStateTransitionError', () => {
    expect(() => {
      VoiceSessionStateMachine.validateTransition('CREATED', 'STREAMING');
    }).toThrow(InvalidStateTransitionError);

    expect(() => {
      VoiceSessionStateMachine.validateTransition('ENDED', 'CONNECTED');
    }).toThrow(InvalidStateTransitionError);

    expect(() => {
      VoiceSessionStateMachine.validateTransition('FAILED', 'CREATED');
    }).toThrow(InvalidStateTransitionError);
  });

  it('identifies terminal states correctly', () => {
    expect(VoiceSessionStateMachine.isTerminal('ENDED')).toBe(true);
    expect(VoiceSessionStateMachine.isTerminal('FAILED')).toBe(true);
    expect(VoiceSessionStateMachine.isTerminal('STREAMING')).toBe(false);
    expect(VoiceSessionStateMachine.isTerminal('CONNECTED')).toBe(false);
  });
});

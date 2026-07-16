import type { VoiceSessionState } from '../types/voice-server.types';
import {
  VOICE_SESSION_STATE_CREATED,
  VOICE_SESSION_STATE_CONNECTING,
  VOICE_SESSION_STATE_CONNECTED,
  VOICE_SESSION_STATE_STREAMING,
  VOICE_SESSION_STATE_PAUSED,
  VOICE_SESSION_STATE_RESUMED,
  VOICE_SESSION_STATE_DISCONNECTING,
  VOICE_SESSION_STATE_ENDED,
  VOICE_SESSION_STATE_FAILED,
} from '../types/voice-server.types';
import { InvalidStateTransitionError } from '../errors/voice-server.errors';

export class VoiceSessionStateMachine {
  private static readonly VALID_TRANSITIONS: Record<VoiceSessionState, Set<VoiceSessionState>> = {
    [VOICE_SESSION_STATE_CREATED]: new Set([
      VOICE_SESSION_STATE_CONNECTING,
      VOICE_SESSION_STATE_ENDED,
      VOICE_SESSION_STATE_FAILED,
    ]),
    [VOICE_SESSION_STATE_CONNECTING]: new Set([
      VOICE_SESSION_STATE_CONNECTED,
      VOICE_SESSION_STATE_ENDED,
      VOICE_SESSION_STATE_FAILED,
    ]),
    [VOICE_SESSION_STATE_CONNECTED]: new Set([
      VOICE_SESSION_STATE_STREAMING,
      VOICE_SESSION_STATE_DISCONNECTING,
      VOICE_SESSION_STATE_ENDED,
      VOICE_SESSION_STATE_FAILED,
    ]),
    [VOICE_SESSION_STATE_STREAMING]: new Set([
      VOICE_SESSION_STATE_PAUSED,
      VOICE_SESSION_STATE_DISCONNECTING,
      VOICE_SESSION_STATE_ENDED,
      VOICE_SESSION_STATE_FAILED,
    ]),
    [VOICE_SESSION_STATE_PAUSED]: new Set([
      VOICE_SESSION_STATE_RESUMED,
      VOICE_SESSION_STATE_DISCONNECTING,
      VOICE_SESSION_STATE_ENDED,
      VOICE_SESSION_STATE_FAILED,
    ]),
    [VOICE_SESSION_STATE_RESUMED]: new Set([
      VOICE_SESSION_STATE_STREAMING,
      VOICE_SESSION_STATE_PAUSED,
      VOICE_SESSION_STATE_DISCONNECTING,
      VOICE_SESSION_STATE_ENDED,
      VOICE_SESSION_STATE_FAILED,
    ]),
    [VOICE_SESSION_STATE_DISCONNECTING]: new Set([
      VOICE_SESSION_STATE_ENDED,
      VOICE_SESSION_STATE_FAILED,
    ]),
    [VOICE_SESSION_STATE_ENDED]: new Set(), // Terminal
    [VOICE_SESSION_STATE_FAILED]: new Set(), // Terminal
  };

  /**
   * Validates if transition from `currentState` to `targetState` is permissible.
   * Throws `InvalidStateTransitionError` if prohibited.
   */
  public static validateTransition(currentState: VoiceSessionState, targetState: VoiceSessionState): void {
    if (currentState === targetState) {
      return; // Self transitions are fine (no-op)
    }

    const allowed = this.VALID_TRANSITIONS[currentState];
    if (!allowed || !allowed.has(targetState)) {
      throw new InvalidStateTransitionError(currentState, targetState);
    }
  }

  /**
   * Helper checking if the state is terminal (ended or failed)
   */
  public static isTerminal(state: VoiceSessionState): boolean {
    return state === VOICE_SESSION_STATE_ENDED || state === VOICE_SESSION_STATE_FAILED;
  }
}

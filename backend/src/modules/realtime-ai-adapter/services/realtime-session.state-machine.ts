import {
  REALTIME_SESSION_STATE_CREATED,
  REALTIME_SESSION_STATE_CONNECTING,
  REALTIME_SESSION_STATE_CONNECTED,
  REALTIME_SESSION_STATE_STREAMING,
  REALTIME_SESSION_STATE_PAUSED,
  REALTIME_SESSION_STATE_ENDED,
  REALTIME_SESSION_STATE_FAILED,
  type RealtimeSessionState,
} from '../constants/realtime-ai.constants';
import { RealtimeInvalidStateTransitionError } from '../errors/realtime-ai.errors';

export class RealtimeSessionStateMachine {
  private static readonly VALID_TRANSITIONS: Record<RealtimeSessionState, Set<RealtimeSessionState>> = {
    [REALTIME_SESSION_STATE_CREATED]: new Set([
      REALTIME_SESSION_STATE_CONNECTING,
      REALTIME_SESSION_STATE_ENDED,
      REALTIME_SESSION_STATE_FAILED,
    ]),
    [REALTIME_SESSION_STATE_CONNECTING]: new Set([
      REALTIME_SESSION_STATE_CONNECTED,
      REALTIME_SESSION_STATE_ENDED,
      REALTIME_SESSION_STATE_FAILED,
    ]),
    [REALTIME_SESSION_STATE_CONNECTED]: new Set([
      REALTIME_SESSION_STATE_STREAMING,
      REALTIME_SESSION_STATE_ENDED,
      REALTIME_SESSION_STATE_FAILED,
    ]),
    [REALTIME_SESSION_STATE_STREAMING]: new Set([
      REALTIME_SESSION_STATE_PAUSED,
      REALTIME_SESSION_STATE_ENDED,
      REALTIME_SESSION_STATE_FAILED,
    ]),
    [REALTIME_SESSION_STATE_PAUSED]: new Set([
      REALTIME_SESSION_STATE_STREAMING,
      REALTIME_SESSION_STATE_ENDED,
      REALTIME_SESSION_STATE_FAILED,
    ]),
    [REALTIME_SESSION_STATE_ENDED]: new Set(),  // Terminal
    [REALTIME_SESSION_STATE_FAILED]: new Set(), // Terminal
  };

  public static validateTransition(currentState: RealtimeSessionState, targetState: RealtimeSessionState): void {
    if (currentState === targetState) {
      return; // No-op
    }

    const allowed = this.VALID_TRANSITIONS[currentState];
    if (!allowed || !allowed.has(targetState)) {
      throw new RealtimeInvalidStateTransitionError(currentState, targetState);
    }
  }

  public static isTerminal(state: RealtimeSessionState): boolean {
    return state === REALTIME_SESSION_STATE_ENDED || state === REALTIME_SESSION_STATE_FAILED;
  }
}

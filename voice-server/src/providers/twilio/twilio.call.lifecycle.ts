/**
 * Twilio Voice Provider — Call State Lifecycle Machine
 */

import type { TwilioCallState } from './twilio.constants';
import {
  TWILIO_CALL_STATE_CREATED,
  TWILIO_CALL_STATE_RINGING,
  TWILIO_CALL_STATE_ANSWERED,
  TWILIO_CALL_STATE_STREAMING,
  TWILIO_CALL_STATE_ON_HOLD,
  TWILIO_CALL_STATE_RESUMED,
  TWILIO_CALL_STATE_TRANSFERRING,
  TWILIO_CALL_STATE_ENDING,
  TWILIO_CALL_STATE_ENDED,
  TWILIO_CALL_STATE_FAILED,
} from './twilio.constants';
import { CallLifecycleFailure } from './twilio.errors';

export class TwilioCallLifecycle {
  private static readonly VALID_TRANSITIONS: Record<TwilioCallState, Set<TwilioCallState>> = {
    [TWILIO_CALL_STATE_CREATED]: new Set([
      TWILIO_CALL_STATE_RINGING,
      TWILIO_CALL_STATE_ANSWERED,
      TWILIO_CALL_STATE_ENDED,
      TWILIO_CALL_STATE_FAILED,
    ]),
    [TWILIO_CALL_STATE_RINGING]: new Set([
      TWILIO_CALL_STATE_ANSWERED,
      TWILIO_CALL_STATE_ENDED,
      TWILIO_CALL_STATE_FAILED,
    ]),
    [TWILIO_CALL_STATE_ANSWERED]: new Set([
      TWILIO_CALL_STATE_STREAMING,
      TWILIO_CALL_STATE_ENDING,
      TWILIO_CALL_STATE_ENDED,
      TWILIO_CALL_STATE_FAILED,
    ]),
    [TWILIO_CALL_STATE_STREAMING]: new Set([
      TWILIO_CALL_STATE_ON_HOLD,
      TWILIO_CALL_STATE_TRANSFERRING,
      TWILIO_CALL_STATE_ENDING,
      TWILIO_CALL_STATE_ENDED,
      TWILIO_CALL_STATE_FAILED,
    ]),
    [TWILIO_CALL_STATE_ON_HOLD]: new Set([
      TWILIO_CALL_STATE_RESUMED,
      TWILIO_CALL_STATE_ENDING,
      TWILIO_CALL_STATE_ENDED,
      TWILIO_CALL_STATE_FAILED,
    ]),
    [TWILIO_CALL_STATE_RESUMED]: new Set([
      TWILIO_CALL_STATE_STREAMING,
      TWILIO_CALL_STATE_ENDING,
      TWILIO_CALL_STATE_ENDED,
      TWILIO_CALL_STATE_FAILED,
    ]),
    [TWILIO_CALL_STATE_TRANSFERRING]: new Set([
      TWILIO_CALL_STATE_ENDED,
      TWILIO_CALL_STATE_FAILED,
    ]),
    [TWILIO_CALL_STATE_ENDING]: new Set([
      TWILIO_CALL_STATE_ENDED,
      TWILIO_CALL_STATE_FAILED,
    ]),
    [TWILIO_CALL_STATE_ENDED]: new Set(),  // Terminal
    [TWILIO_CALL_STATE_FAILED]: new Set(), // Terminal
  };

  public static validateTransition(current: TwilioCallState, target: TwilioCallState): void {
    if (current === target) {
      return; // No-op
    }

    const allowed = this.VALID_TRANSITIONS[current];
    if (!allowed || !allowed.has(target)) {
      throw new CallLifecycleFailure(`Illegal call lifecycle transition from '${current}' to '${target}'.`);
    }
  }

  public static isTerminal(state: TwilioCallState): boolean {
    return state === TWILIO_CALL_STATE_ENDED || state === TWILIO_CALL_STATE_FAILED;
  }
}

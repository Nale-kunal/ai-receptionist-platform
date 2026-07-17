/**
 * Twilio Voice Provider — Call Lifecycle State Machine Tests
 */

import { TwilioCallLifecycle } from '../twilio.call.lifecycle';
import { CallLifecycleFailure } from '../twilio.errors';
import {
  TWILIO_CALL_STATE_CREATED,
  TWILIO_CALL_STATE_RINGING,
  TWILIO_CALL_STATE_ANSWERED,
  TWILIO_CALL_STATE_STREAMING,
  TWILIO_CALL_STATE_ENDED,
  TWILIO_CALL_STATE_FAILED,
} from '../twilio.constants';

describe('Twilio Call Lifecycle States', () => {
  it('allows self-transition as no-op', () => {
    expect(() =>
      TwilioCallLifecycle.validateTransition(TWILIO_CALL_STATE_STREAMING, TWILIO_CALL_STATE_STREAMING),
    ).not.toThrow();
  });

  it('allows valid progress transition loops', () => {
    expect(() =>
      TwilioCallLifecycle.validateTransition(TWILIO_CALL_STATE_CREATED, TWILIO_CALL_STATE_ANSWERED),
    ).not.toThrow();

    expect(() =>
      TwilioCallLifecycle.validateTransition(TWILIO_CALL_STATE_ANSWERED, TWILIO_CALL_STATE_STREAMING),
    ).not.toThrow();
  });

  it('allows direct failures from non-terminal states', () => {
    expect(() =>
      TwilioCallLifecycle.validateTransition(TWILIO_CALL_STATE_STREAMING, TWILIO_CALL_STATE_FAILED),
    ).not.toThrow();
  });

  it('rejects illegal backward or skip transitions', () => {
    expect(() =>
      TwilioCallLifecycle.validateTransition(TWILIO_CALL_STATE_ENDED, TWILIO_CALL_STATE_STREAMING),
    ).toThrow(CallLifecycleFailure);

    expect(() =>
      TwilioCallLifecycle.validateTransition(TWILIO_CALL_STATE_STREAMING, TWILIO_CALL_STATE_CREATED),
    ).toThrow(CallLifecycleFailure);
  });

  it('identifies terminal states correctly', () => {
    expect(TwilioCallLifecycle.isTerminal(TWILIO_CALL_STATE_ENDED)).toBe(true);
    expect(TwilioCallLifecycle.isTerminal(TWILIO_CALL_STATE_FAILED)).toBe(true);
    expect(TwilioCallLifecycle.isTerminal(TWILIO_CALL_STATE_STREAMING)).toBe(false);
  });
});

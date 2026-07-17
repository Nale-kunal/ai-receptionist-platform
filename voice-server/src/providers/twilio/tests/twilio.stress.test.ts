/**
 * Twilio Voice Provider — Concurrency and Stress Verification
 */

import { TwilioVoiceSessionManager } from '../twilio.voice-session.manager';
import { TwilioAudioStream } from '../twilio.audio.stream';
import { TwilioMetricsCollector } from '../twilio.metrics.collector';
import { TwilioSecurityValidator } from '../twilio.security.validator';
import { loadTwilioConfig } from '../twilio.config';

describe('Twilio Telephony Provider Stress Verification', () => {
  // ---------------------------------------------------------------------------
  // Session manager concurrency
  // ---------------------------------------------------------------------------

  it('manages 10,000 concurrent voice sessions without leakage', () => {
    const manager = new TwilioVoiceSessionManager();
    const count = 10000;

    const start = Date.now();

    for (let i = 0; i < count; i++) {
      manager.createSession(
        `vses_stress_${i}`,
        `CA_stress_sid_${i}`,
        `tenant_${i}`,
        null,
        { index: i },
      );
    }

    const elapsed = Date.now() - start;
    expect(manager.activeCount()).toBe(count);
    expect(elapsed).toBeLessThan(1000); // 10K inserts must run in < 1s

    // Remove all of them
    for (let i = 0; i < count; i++) {
      manager.removeSession(`vses_stress_${i}`);
    }

    expect(manager.activeCount()).toBe(0);
  });

  // ---------------------------------------------------------------------------
  // Webhook Flooding (security signatures cache checks)
  // ---------------------------------------------------------------------------

  it('verifies 10,000 signatures in sliding cache without performance loss', () => {
    const validator = new TwilioSecurityValidator('auth_token_stress');
    const count = 10000;

    const start = Date.now();

    // 10,000 unique checks
    for (let i = 0; i < count; i++) {
      validator.checkReplay(`signature_string_hash_${i}`);
    }

    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(1000); // 10K signature hash inserts must complete in < 1s
  });

  // ---------------------------------------------------------------------------
  // Reconnect metrics storm
  // ---------------------------------------------------------------------------

  it('tracks 10,000 reconnect attempts in metrics collector without issues', () => {
    const collector = new TwilioMetricsCollector();
    const count = 10000;

    for (let i = 0; i < count; i++) {
      collector.trackReconnect();
    }

    const snapshot = collector.getSnapshot();
    expect(snapshot.reconnectAttemptsCount).toBe(count);
  });
});

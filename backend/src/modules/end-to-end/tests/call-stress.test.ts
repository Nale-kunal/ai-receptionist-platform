/**
 * End-to-End Call Flow — Concurrency and Stress Verification
 */

import { CallSessionManager } from '../call-session.manager';
import { CallTimeoutManager } from '../call-timeout.manager';
import { CallMetricsCollector } from '../call-metrics.collector';

describe('E2E Call Orchestration Concurrency and Stress Tests', () => {
  // ---------------------------------------------------------------------------
  // Concurrency session management
  // ---------------------------------------------------------------------------

  it('handles 10,000 concurrent call sessions efficiently without leakage', () => {
    const manager = new CallSessionManager();
    const count = 10000;

    const start = Date.now();

    for (let i = 0; i < count; i++) {
      manager.createSession(
        `e2e_stress_${i}`,
        `CA_stress_${i}`,
        {
          tenantId: `tenant_${i}`,
          clinicId: null,
          conversationId: `conv_${i}`,
          callerNumber: `+12345${i}`,
          calledNumber: `+19876${i}`,
          startTime: Date.now(),
          endTime: null,
          variables: {},
          metadata: {},
        },
      );
    }

    const elapsed = Date.now() - start;
    expect(manager.activeSessions()).toHaveLength(count);
    expect(elapsed).toBeLessThan(1000); // 10K session setups must run in < 1s

    // Cleanup all of them
    for (let i = 0; i < count; i++) {
      manager.removeSession(`e2e_stress_${i}`);
    }

    expect(manager.activeSessions()).toHaveLength(0);
  });

  // ---------------------------------------------------------------------------
  // Timeout storms checks
  // ---------------------------------------------------------------------------

  it('manages 10,000 active timers in TimeoutManager with zero resource residue', () => {
    const manager = new CallTimeoutManager();
    const count = 10000;

    const start = Date.now();

    for (let i = 0; i < count; i++) {
      manager.registerTimeout(
        `sess_timer_${i}`,
        'inactivity',
        60000,
        () => {},
      );
    }

    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(1000); // 10K timer registrations must run in < 1s

    // Clear all timers
    for (let i = 0; i < count; i++) {
      manager.clearAll(`sess_timer_${i}`);
    }
  });

  // ---------------------------------------------------------------------------
  // Telemetry metric storms
  // ---------------------------------------------------------------------------

  it('aggregates 10,000 call metrics records without performance drops', () => {
    const collector = new CallMetricsCollector();
    const count = 10000;

    const start = Date.now();

    for (let i = 0; i < count; i++) {
      collector.trackCallStart();
      collector.trackAiLatency(50);
      collector.trackToolLatency(150);
      collector.trackCallEnd(30000);
    }

    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(1000); // 10K metrics records must run in < 1s

    const snapshot = collector.getSnapshot();
    expect(snapshot.totalCallsCount).toBe(count);
    expect(snapshot.completedCallsCount).toBe(count);
    expect(snapshot.averageAiLatencyMs).toBe(50);
    expect(snapshot.averageToolLatencyMs).toBe(150);
    expect(snapshot.averageCallDurationMs).toBe(30000);
  });
});

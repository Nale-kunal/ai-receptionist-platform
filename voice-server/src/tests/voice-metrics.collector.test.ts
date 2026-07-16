import { VoiceMetricsCollector } from '../services/voice-metrics.collector';

describe('VoiceMetricsCollector', () => {
  let collector: VoiceMetricsCollector;

  beforeEach(() => {
    collector = new VoiceMetricsCollector();
  });

  it('tracks active and concurrent sessions', () => {
    collector.trackSessionStart('t1');
    collector.trackSessionStart('t1');

    let metrics = collector.getMetrics();
    expect(metrics.concurrentSessions).toBe(2);

    collector.trackSessionEnd('t1', 1000);
    metrics = collector.getMetrics();
    expect(metrics.concurrentSessions).toBe(1);
    expect(metrics.averageSessionDurationMs).toBe(1000);
  });

  it('calculates average values and packet loss rates accurately', () => {
    collector.trackSessionStart('t1');
    collector.registerFrameReceived();
    collector.registerFrameReceived();
    collector.trackDroppedFrame(); // 1 drop out of 3 total packets (33%)

    collector.trackLatency(20);
    collector.trackLatency(40);

    const metrics = collector.getMetrics();
    expect(metrics.averageLatencyMs).toBe(30);
    expect(metrics.totalDroppedFrames).toBe(1);
    expect(metrics.estimatedPacketLossRate).toBeCloseTo(0.333, 3);
  });
});

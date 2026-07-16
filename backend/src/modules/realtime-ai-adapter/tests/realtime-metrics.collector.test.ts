import { RealtimeMetricsCollector } from '../services/realtime-metrics.collector';

describe('RealtimeMetricsCollector', () => {
  let collector: RealtimeMetricsCollector;

  beforeEach(() => {
    collector = new RealtimeMetricsCollector();
  });

  it('tracks concurrent session counts', () => {
    collector.trackSessionStart('t1');
    collector.trackSessionStart('t1');

    let metrics = collector.getMetrics();
    expect(metrics.concurrentSessions).toBe(2);

    collector.trackSessionEnd('t1', 1000);
    metrics = collector.getMetrics();
    expect(metrics.concurrentSessions).toBe(1);
  });

  it('calculates token counts, pricing, and latency averages accurately', () => {
    collector.trackSessionStart('t1');
    collector.trackTokens('t1', 1000, 2000); // 3000 tokens total

    collector.trackResponseTime('t1', 50);
    collector.trackResponseTime('t1', 150);

    const metrics = collector.getMetrics();
    expect(metrics.totalTokensUsed).toBe(3000);
    expect(metrics.averageResponseTimeMs).toBe(1000 / 10); // Wait, (50+150)/2 = 100
    expect(metrics.averageResponseTimeMs).toBe(100);
    
    // Pricing check: 1000 * 0.000005 + 2000 * 0.00002 = 0.005 + 0.04 = 0.045
    expect(metrics.totalCostEstimateUSD).toBeCloseTo(0.045, 5);
  });
});

import type { IRealtimeMetricsCollector } from '../interfaces/realtime-ai.interfaces';
import type { RealtimeMetrics } from '../types/realtime-ai.types';

export class RealtimeMetricsCollector implements IRealtimeMetricsCollector {
  private activeSessionsCount = 0;
  private totalInputTokens = 0;
  private totalOutputTokens = 0;
  private totalReconnects = 0;
  private connectionFailures = 0;
  private responseTimesMs: number[] = [];

  // Approximate cost mapping for pricing logic (e.g. GPT-4o Realtime)
  private readonly inputTokenPriceUSD = 0.000005;  // $5.00 per million
  private readonly outputTokenPriceUSD = 0.000020; // $20.00 per million

  public trackSessionStart(_tenantId: string): void {
    this.activeSessionsCount++;
  }

  public trackSessionEnd(_tenantId: string, _durationMs: number): void {
    if (this.activeSessionsCount > 0) {
      this.activeSessionsCount--;
    }
  }

  public trackTokens(_tenantId: string, inputTokens: number, outputTokens: number): void {
    this.totalInputTokens += inputTokens;
    this.totalOutputTokens += outputTokens;
  }

  public trackResponseTime(_tenantId: string, latencyMs: number): void {
    this.responseTimesMs.push(latencyMs);
  }

  public trackReconnect(): void {
    this.totalReconnects++;
  }

  public trackConnectionFailure(): void {
    this.connectionFailures++;
  }

  public getMetrics(): RealtimeMetrics {
    const avgResponseTime = this.calculateAverage(this.responseTimesMs);
    const totalTokens = this.totalInputTokens + this.totalOutputTokens;
    
    // Cost estimation
    const costEstimate = 
      (this.totalInputTokens * this.inputTokenPriceUSD) + 
      (this.totalOutputTokens * this.outputTokenPriceUSD);

    return {
      concurrentSessions: this.activeSessionsCount,
      totalTokensUsed: totalTokens,
      inputTokensCount: this.totalInputTokens,
      outputTokensCount: this.totalOutputTokens,
      averageResponseTimeMs: avgResponseTime,
      totalCostEstimateUSD: costEstimate,
      reconnectAttemptsCount: this.totalReconnects,
      failedConnectionsCount: this.connectionFailures,
    };
  }

  private calculateAverage(arr: number[]): number {
    if (arr.length === 0) return 0;
    const sum = arr.reduce((acc, val) => acc + val, 0);
    return sum / arr.length;
  }
}

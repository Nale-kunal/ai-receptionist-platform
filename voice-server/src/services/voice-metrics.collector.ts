import type { IVoiceMetricsCollector } from '../interfaces/voice-server.interfaces';
import type { VoiceMetrics } from '../types/voice-server.types';

export class VoiceMetricsCollector implements IVoiceMetricsCollector {
  private activeSessionsCount = 0;
  private totalSessionsCount = 0;
  private totalReconnects = 0;
  private totalDroppedFrames = 0;
  private totalReceivedFrames = 0;
  private connectionFailures = 0;
  private providerFailures = 0;
  private bufferUsages: number[] = [];
  private sessionDurationsMs: number[] = [];
  private latenciesMs: number[] = [];
  private totalStreamingTimeMs = 0;

  public trackSessionStart(_tenantId: string): void {
    this.activeSessionsCount++;
    this.totalSessionsCount++;
  }

  public trackSessionEnd(_tenantId: string, durationMs: number): void {
    if (this.activeSessionsCount > 0) {
      this.activeSessionsCount--;
    }
    this.sessionDurationsMs.push(durationMs);
    this.totalStreamingTimeMs += durationMs;
  }

  public trackDroppedFrame(): void {
    this.totalDroppedFrames++;
  }

  public trackReconnect(): void {
    this.totalReconnects++;
  }

  public trackLatency(latencyMs: number): void {
    this.latenciesMs.push(latencyMs);
  }

  public trackBufferUsage(usageRatio: number): void {
    this.bufferUsages.push(usageRatio);
  }

  public trackConnectionFailure(): void {
    this.connectionFailures++;
  }

  public trackProviderFailure(): void {
    this.providerFailures++;
  }

  public registerFrameReceived(): void {
    this.totalReceivedFrames++;
  }

  public getMetrics(): VoiceMetrics {
    const avgLatency = this.calculateAverage(this.latenciesMs);
    const avgSessionDur = this.calculateAverage(this.sessionDurationsMs);
    const avgBufferUsage = this.calculateAverage(this.bufferUsages);

    const totalSentAndReceived = this.totalReceivedFrames + this.totalDroppedFrames;
    const packetLossRate = totalSentAndReceived > 0 
      ? this.totalDroppedFrames / totalSentAndReceived 
      : 0;

    return {
      concurrentSessions: this.activeSessionsCount,
      averageLatencyMs: avgLatency,
      totalReconnectCount: this.totalReconnects,
      totalDroppedFrames: this.totalDroppedFrames,
      estimatedPacketLossRate: packetLossRate,
      audioBufferUsageRatio: avgBufferUsage,
      averageSessionDurationMs: avgSessionDur,
      connectionFailuresCount: this.connectionFailures,
      providerFailuresCount: this.providerFailures,
      totalStreamingDurationMs: this.totalStreamingTimeMs,
    };
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private calculateAverage(arr: number[]): number {
    if (arr.length === 0) return 0;
    const sum = arr.reduce((acc, val) => acc + val, 0);
    return sum / arr.length;
  }
}

/**
 * OpenAI Realtime Provider — Metrics Collector
 *
 * Tracks provider-level operational telemetry.
 * Implements IOpenAiMetricsCollector for internal use.
 * Exposes data compatible with IRealtimeMetricsCollector for the adapter layer.
 */

import type { IOpenAiMetricsCollector } from './openai-realtime.interfaces';
import type { OpenAiUsageSnapshot } from './openai-realtime.types';
import type { RealtimeMetrics } from '../realtime-ai-adapter/types/realtime-ai.types';

export class OpenAiRealtimeMetricsCollector implements IOpenAiMetricsCollector {
  // Active session tracking
  private readonly sessionStartTimes = new Map<string, number>();
  private activeSessions = 0;

  // Token totals
  private totalInputTokens = 0;
  private totalOutputTokens = 0;

  // Audio throughput
  private totalBytesSent = 0;
  private totalBytesReceived = 0;

  // Reliability counters
  private reconnectCount = 0;
  private connectionFailureCount = 0;

  // Latency tracking
  private totalResponseLatencyMs = 0;
  private responseCount = 0;

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  public recordSessionStart(sessionId: string): void {
    this.sessionStartTimes.set(sessionId, Date.now());
    this.activeSessions += 1;
  }

  public recordSessionEnd(sessionId: string, durationMs: number): void {
    this.sessionStartTimes.delete(sessionId);
    this.activeSessions = Math.max(0, this.activeSessions - 1);
    // durationMs provided externally for precision
    void durationMs; // recorded by caller in logs; aggregate here if needed
  }

  // ---------------------------------------------------------------------------
  // Token Usage
  // ---------------------------------------------------------------------------

  public recordUsage(snapshot: OpenAiUsageSnapshot): void {
    this.totalInputTokens += snapshot.inputTokens;
    this.totalOutputTokens += snapshot.outputTokens;
  }

  // ---------------------------------------------------------------------------
  // Audio Throughput
  // ---------------------------------------------------------------------------

  public recordAudioFrameSent(_sessionId: string, bytes: number): void {
    this.totalBytesSent += bytes;
  }

  public recordAudioFrameReceived(_sessionId: string, bytes: number): void {
    this.totalBytesReceived += bytes;
  }

  // ---------------------------------------------------------------------------
  // Reliability
  // ---------------------------------------------------------------------------

  public recordReconnect(_sessionId: string): void {
    this.reconnectCount += 1;
  }

  public recordConnectionFailure(): void {
    this.connectionFailureCount += 1;
  }

  // ---------------------------------------------------------------------------
  // Latency
  // ---------------------------------------------------------------------------

  public recordResponseLatency(_sessionId: string, latencyMs: number): void {
    this.totalResponseLatencyMs += latencyMs;
    this.responseCount += 1;
  }

  // ---------------------------------------------------------------------------
  // Getters
  // ---------------------------------------------------------------------------

  public getActiveSessionCount(): number {
    return this.activeSessions;
  }

  public getTotalTokensUsed(): number {
    return this.totalInputTokens + this.totalOutputTokens;
  }

  public getAverageResponseLatencyMs(): number {
    if (this.responseCount === 0) return 0;
    return Math.round(this.totalResponseLatencyMs / this.responseCount);
  }

  // ---------------------------------------------------------------------------
  // Adapter-Compatible Export
  // ---------------------------------------------------------------------------

  /**
   * Returns a RealtimeMetrics snapshot compatible with IRealtimeMetricsCollector.
   * Used by the adapter layer to aggregate provider metrics.
   */
  public toRealtimeMetrics(): RealtimeMetrics {
    return {
      concurrentSessions: this.activeSessions,
      totalTokensUsed: this.getTotalTokensUsed(),
      inputTokensCount: this.totalInputTokens,
      outputTokensCount: this.totalOutputTokens,
      averageResponseTimeMs: this.getAverageResponseLatencyMs(),
      totalCostEstimateUSD: this.estimateCostUSD(),
      reconnectAttemptsCount: this.reconnectCount,
      failedConnectionsCount: this.connectionFailureCount,
    };
  }

  // ---------------------------------------------------------------------------
  // Cost Estimation (approximate, based on public pricing)
  // ---------------------------------------------------------------------------

  private estimateCostUSD(): number {
    // GPT-4o Realtime: ~$5/1M input tokens, ~$20/1M output tokens (approximate)
    const inputCost = (this.totalInputTokens / 1_000_000) * 5;
    const outputCost = (this.totalOutputTokens / 1_000_000) * 20;
    return Math.round((inputCost + outputCost) * 10_000) / 10_000;
  }

  // ---------------------------------------------------------------------------
  // Reset (for testing)
  // ---------------------------------------------------------------------------

  public reset(): void {
    this.sessionStartTimes.clear();
    this.activeSessions = 0;
    this.totalInputTokens = 0;
    this.totalOutputTokens = 0;
    this.totalBytesSent = 0;
    this.totalBytesReceived = 0;
    this.reconnectCount = 0;
    this.connectionFailureCount = 0;
    this.totalResponseLatencyMs = 0;
    this.responseCount = 0;
  }
}

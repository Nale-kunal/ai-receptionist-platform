/**
 * End-to-End Call Flow — Metrics Collector
 */

import type { ICallMetricsCollector } from './end-to-end.interfaces';
import type { E2eMetricsSnapshot } from './end-to-end.types';

export class CallMetricsCollector implements ICallMetricsCollector {
  private totalCalls = 0;
  private completedCalls = 0;
  private failedCalls = 0;
  private activeCalls = 0;
  private totalDurationMs = 0;
  
  private totalAiLatencyMs = 0;
  private aiLatencyCount = 0;
  
  private totalToolLatencyMs = 0;
  private toolLatencyCount = 0;

  private totalCleanupMs = 0;
  private cleanupCount = 0;

  private interruptionsCount = 0;
  private retriesCount = 0;
  private timeoutsCount = 0;

  public trackCallStart(): void {
    this.totalCalls += 1;
    this.activeCalls += 1;
  }

  public trackCallEnd(durationMs: number): void {
    this.activeCalls = Math.max(0, this.activeCalls - 1);
    this.completedCalls += 1;
    this.totalDurationMs += durationMs;
  }

  public trackCallFailure(): void {
    this.activeCalls = Math.max(0, this.activeCalls - 1);
    this.failedCalls += 1;
  }

  public trackAiLatency(ms: number): void {
    this.totalAiLatencyMs += ms;
    this.aiLatencyCount += 1;
  }

  public trackToolLatency(ms: number): void {
    this.totalToolLatencyMs += ms;
    this.toolLatencyCount += 1;
  }

  public trackInterruption(): void {
    this.interruptionsCount += 1;
  }

  public trackRetry(): void {
    this.retriesCount += 1;
  }

  public trackTimeout(): void {
    this.timeoutsCount += 1;
  }

  public trackCleanup(ms: number): void {
    this.totalCleanupMs += ms;
    this.cleanupCount += 1;
  }

  public getSnapshot(): E2eMetricsSnapshot {
    const averageCallDurationMs = this.completedCalls > 0
      ? Math.round(this.totalDurationMs / this.completedCalls)
      : 0;

    const averageAiLatencyMs = this.aiLatencyCount > 0
      ? Math.round(this.totalAiLatencyMs / this.aiLatencyCount)
      : 0;

    const averageToolLatencyMs = this.toolLatencyCount > 0
      ? Math.round(this.totalToolLatencyMs / this.toolLatencyCount)
      : 0;

    const averageCleanupDurationMs = this.cleanupCount > 0
      ? Math.round(this.totalCleanupMs / this.cleanupCount)
      : 0;

    const callSuccessRate = this.totalCalls > 0
      ? (this.completedCalls / this.totalCalls)
      : 1.0;

    return {
      totalCallsCount: this.totalCalls,
      completedCallsCount: this.completedCalls,
      failedCallsCount: this.failedCalls,
      activeCallsCount: this.activeCalls,
      averageCallDurationMs,
      averageAiLatencyMs,
      averageToolLatencyMs,
      totalInterruptionsCount: this.interruptionsCount,
      totalRetriesCount: this.retriesCount,
      totalTimeoutsCount: this.timeoutsCount,
      averageCleanupDurationMs,
      callSuccessRate,
    };
  }

  public reset(): void {
    this.totalCalls = 0;
    this.completedCalls = 0;
    this.failedCalls = 0;
    this.activeCalls = 0;
    this.totalDurationMs = 0;
    this.totalAiLatencyMs = 0;
    this.aiLatencyCount = 0;
    this.totalToolLatencyMs = 0;
    this.toolLatencyCount = 0;
    this.totalCleanupMs = 0;
    this.cleanupCount = 0;
    this.interruptionsCount = 0;
    this.retriesCount = 0;
    this.timeoutsCount = 0;
  }
}
export const callMetricsCollector = new CallMetricsCollector();

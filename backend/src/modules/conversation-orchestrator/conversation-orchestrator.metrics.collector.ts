import type { IOrchestratorMetricsCollector } from './conversation-orchestrator.interfaces';
import type { OrchestratorMetrics } from './conversation-orchestrator.types';

export class OrchestratorMetricsCollector implements IOrchestratorMetricsCollector {
  private activeConversationsCount = 0;
  private totalInterruptionCount = 0;
  private totalReconnectCount = 0;
  private totalTimeoutCount = 0;
  private totalTurnsCount = 0;
  private successSessions = 0;
  private failedSessions = 0;
  
  private lastLatencyMs = 0;
  private lastTranscriptSize = 0;
  private lastTransitionDurationMs = 0;
  private lastCleanupDurationMs = 0;

  public trackSessionStart(_tenantId: string): void {
    this.activeConversationsCount++;
  }

  public trackSessionEnd(_tenantId: string, durationMs: number): void {
    if (this.activeConversationsCount > 0) {
      this.activeConversationsCount--;
    }
    this.successSessions++;
  }

  public trackInterruption(): void {
    this.totalInterruptionCount++;
  }

  public trackResume(): void {
    // track active resumption
  }

  public trackResponse(): void {
    this.totalTurnsCount++;
  }

  public trackToolRequest(): void {
    // track tool calls
  }

  public trackReconnect(): void {
    this.totalReconnectCount++;
  }

  public trackTimeout(): void {
    this.totalTimeoutCount++;
    this.failedSessions++;
  }

  public trackLatency(latencyMs: number): void {
    this.lastLatencyMs = latencyMs;
  }

  public trackTranscriptSize(charCount: number): void {
    this.lastTranscriptSize = charCount;
  }

  public trackTransition(durationMs: number): void {
    this.lastTransitionDurationMs = durationMs;
  }

  public trackCleanup(durationMs: number): void {
    this.lastCleanupDurationMs = durationMs;
  }

  public getMetrics(): OrchestratorMetrics {
    const totalSessions = this.successSessions + this.failedSessions;
    const rate = totalSessions > 0 ? (this.successSessions / totalSessions) * 100 : 100;

    return {
      totalDurationMs: 0,
      orchestrationLatencyMs: this.lastLatencyMs,
      aiLatencyMs: 0,
      providerLatencyMs: 0,
      transcriptCharacterCount: this.lastTranscriptSize,
      interruptionCount: this.totalInterruptionCount,
      retryCount: this.totalReconnectCount,
      timeoutCount: this.totalTimeoutCount,
      recoveryDurationMs: 0,
      stateTransitionDurationMs: this.lastTransitionDurationMs,
      cleanupDurationMs: this.lastCleanupDurationMs,
      memoryUsageBytes: process.memoryUsage().heapUsed,
      activeConversationsCount: this.activeConversationsCount,
      successRatePercent: rate,
    };
  }
}

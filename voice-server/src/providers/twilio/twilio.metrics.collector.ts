/**
 * Twilio Voice Provider — Metrics Collector
 */

import type { TwilioMetricsSnapshot } from './twilio.types';

export class TwilioMetricsCollector {
  private activeCalls = 0;
  private completedCalls = 0;
  private failedCalls = 0;
  private totalCalls = 0;
  private reconnectAttempts = 0;
  private webhookFailures = 0;
  private mediaStreamFailures = 0;
  private totalCallDurationMs = 0;
  private totalLatencyMs = 0;
  private latencyCount = 0;
  private packetsReceived = 0;
  private packetsDropped = 0;
  private dtmfEventsCount = 0;
  private silenceEventsCount = 0;

  public trackCallStart(): void {
    this.activeCalls += 1;
    this.totalCalls += 1;
  }

  public trackCallEnd(durationMs: number): void {
    this.activeCalls = Math.max(0, this.activeCalls - 1);
    this.completedCalls += 1;
    this.totalCallDurationMs += durationMs;
  }

  public trackCallFailure(): void {
    this.activeCalls = Math.max(0, this.activeCalls - 1);
    this.failedCalls += 1;
  }

  public trackReconnect(): void {
    this.reconnectAttempts += 1;
  }

  public trackWebhookFailure(): void {
    this.webhookFailures += 1;
  }

  public trackMediaStreamFailure(): void {
    this.mediaStreamFailures += 1;
  }

  public trackLatency(latencyMs: number): void {
    this.totalLatencyMs += latencyMs;
    this.latencyCount += 1;
  }

  public trackPacketReceived(): void {
    this.packetsReceived += 1;
  }

  public trackPacketDropped(): void {
    this.packetsDropped += 1;
  }

  public trackDtmf(): void {
    this.dtmfEventsCount += 1;
  }

  public trackSilence(): void {
    this.silenceEventsCount += 1;
  }

  public getSnapshot(): TwilioMetricsSnapshot {
    const averageCallDurationMs = this.completedCalls > 0
      ? Math.round(this.totalCallDurationMs / this.completedCalls)
      : 0;

    const averageStreamLatencyMs = this.latencyCount > 0
      ? Math.round(this.totalLatencyMs / this.latencyCount)
      : 0;

    const totalPackets = this.packetsReceived + this.packetsDropped;
    const packetLossRate = totalPackets > 0
      ? this.packetsDropped / totalPackets
      : 0;

    return {
      activeCallsCount: this.activeCalls,
      completedCallsCount: this.completedCalls,
      failedCallsCount: this.failedCalls,
      totalCallsCount: this.totalCalls,
      reconnectAttemptsCount: this.reconnectAttempts,
      webhookFailuresCount: this.webhookFailures,
      mediaStreamFailuresCount: this.mediaStreamFailures,
      averageCallDurationMs,
      averageStreamLatencyMs,
      packetLossRate,
      dtmfCount: this.dtmfEventsCount,
      silenceCount: this.silenceEventsCount,
    };
  }

  public reset(): void {
    this.activeCalls = 0;
    this.completedCalls = 0;
    this.failedCalls = 0;
    this.totalCalls = 0;
    this.reconnectAttempts = 0;
    this.webhookFailures = 0;
    this.mediaStreamFailures = 0;
    this.totalCallDurationMs = 0;
    this.totalLatencyMs = 0;
    this.latencyCount = 0;
    this.packetsReceived = 0;
    this.packetsDropped = 0;
    this.dtmfEventsCount = 0;
    this.silenceEventsCount = 0;
  }
}

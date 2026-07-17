import type { IToolMetricsCollector } from './ai-tool.interfaces';
import type { CircuitBreakerState } from './ai-tool.types';

export class ToolMetricsCollector implements IToolMetricsCollector {
  private readonly executionCounts: Map<string, number> = new Map();
  private readonly latenciesMs: Map<string, number[]> = new Map();
  private readonly failureCounts: Map<string, number> = new Map();
  private readonly breakerStates: Map<string, CircuitBreakerState> = new Map();
  
  private totalRetries = 0;
  private totalTimeouts = 0;
  private totalRateLimitingBlocked = 0;
  private totalAuthorizationFailures = 0;
  private totalValidationFailures = 0;

  public trackExecution(toolId: string, version: string, latencyMs: number, success: boolean): void {
    const key = `${toolId}:${version}`;
    const count = this.executionCounts.get(key) ?? 0;
    this.executionCounts.set(key, count + 1);

    const list = this.latenciesMs.get(key) ?? [];
    list.push(latencyMs);
    this.latenciesMs.set(key, list);

    if (!success) {
      const fails = this.failureCounts.get(key) ?? 0;
      this.failureCounts.set(key, fails + 1);
    }
  }

  public trackRetry(toolId: string, version: string): void {
    this.totalRetries++;
  }

  public trackTimeout(toolId: string, version: string): void {
    this.totalTimeouts++;
  }

  public trackCircuitBreakerState(toolId: string, state: CircuitBreakerState): void {
    this.breakerStates.set(toolId, state);
  }

  public trackRateLimitingEvent(toolId: string, tenantId: string): void {
    this.totalRateLimitingBlocked++;
  }

  public trackAuthorizationFailure(toolId: string, tenantId: string): void {
    this.totalAuthorizationFailures++;
  }

  public trackValidationFailure(toolId: string): void {
    this.totalValidationFailures++;
  }

  public getMetrics(): Record<string, unknown> {
    const toolsObj: Record<string, any> = {};
    const output = {
      totalRetries: this.totalRetries,
      totalTimeouts: this.totalTimeouts,
      totalRateLimitingBlocked: this.totalRateLimitingBlocked,
      totalAuthorizationFailures: this.totalAuthorizationFailures,
      totalValidationFailures: this.totalValidationFailures,
      tools: toolsObj,
    };

    for (const key of this.executionCounts.keys()) {
      const list = this.latenciesMs.get(key) ?? [];
      const total = list.reduce((a, b) => a + b, 0);
      const avg = list.length > 0 ? total / list.length : 0;

      toolsObj[key] = {
        executionCount: this.executionCounts.get(key),
        avgLatencyMs: avg,
        failureCount: this.failureCounts.get(key) ?? 0,
      };
    }

    return output;
  }
}

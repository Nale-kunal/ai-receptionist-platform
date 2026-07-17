import type { IToolCircuitBreaker } from './ai-tool.interfaces';
import type { CircuitBreakerState } from './ai-tool.types';

export class ToolCircuitBreaker implements IToolCircuitBreaker {
  private readonly states: Map<string, CircuitBreakerState> = new Map();
  private readonly failureCounts: Map<string, number> = new Map();
  private readonly successCounts: Map<string, number> = new Map();
  private readonly openTimestamps: Map<string, number> = new Map();

  constructor(
    private readonly config: {
      failureThreshold: number;
      resetTimeoutMs: number;
      halfOpenTrials: number;
    }
  ) {}

  public async checkState(toolId: string): Promise<CircuitBreakerState> {
    const state = this.states.get(toolId) ?? 'closed';

    if (state === 'open') {
      const openTime = this.openTimestamps.get(toolId) ?? 0;
      if (Date.now() - openTime > this.config.resetTimeoutMs) {
        this.states.set(toolId, 'half-open');
        this.successCounts.set(toolId, 0);
        return 'half-open';
      }
    }

    return state;
  }

  public async recordSuccess(toolId: string): Promise<void> {
    const state = this.states.get(toolId) ?? 'closed';

    if (state === 'half-open') {
      const successes = (this.successCounts.get(toolId) ?? 0) + 1;
      this.successCounts.set(toolId, successes);

      if (successes >= this.config.halfOpenTrials) {
        this.states.set(toolId, 'closed');
        this.failureCounts.set(toolId, 0);
      }
    } else if (state === 'closed') {
      this.failureCounts.set(toolId, 0);
    }
  }

  public async recordFailure(toolId: string): Promise<void> {
    const state = this.states.get(toolId) ?? 'closed';

    if (state === 'closed' || state === 'half-open') {
      const failures = (this.failureCounts.get(toolId) ?? 0) + 1;
      this.failureCounts.set(toolId, failures);

      if (failures >= this.config.failureThreshold) {
        this.states.set(toolId, 'open');
        this.openTimestamps.set(toolId, Date.now());
      }
    }
  }
}

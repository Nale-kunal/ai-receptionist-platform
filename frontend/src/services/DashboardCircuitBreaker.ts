import { telemetry } from './telemetry';
import { axiosClient } from './axiosClient';

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF-OPEN';

export class DashboardCircuitBreaker {
  private static instance: DashboardCircuitBreaker;
  private state: CircuitState = 'CLOSED';
  private failureCount = 0;
  private readonly failureThreshold = 5;
  private readonly recoveryTimeoutMs = 15000;
  private lastStateChangeTime = Date.now();

  private constructor() {}

  public static getInstance(): DashboardCircuitBreaker {
    if (!DashboardCircuitBreaker.instance) {
      DashboardCircuitBreaker.instance = new DashboardCircuitBreaker();
    }
    return DashboardCircuitBreaker.instance;
  }

  public getState(): CircuitState {
    if (this.state === 'OPEN') {
      const elapsed = Date.now() - this.lastStateChangeTime;
      if (elapsed > this.recoveryTimeoutMs) {
        this.transitionTo('HALF-OPEN');
      }
    }
    return this.state;
  }

  public recordSuccess(): void {
    if (this.state === 'HALF-OPEN' || this.failureCount > 0) {
      this.failureCount = 0;
      this.transitionTo('CLOSED');
    }
  }

  public recordFailure(error: any): void {
    // 401, 403, and 422 are business/auth errors, not backend degradation
    const status = error?.response?.status;
    if (status === 401 || status === 403 || status === 422) {
      return;
    }

    this.failureCount++;
    if (this.failureCount >= this.failureThreshold && this.state !== 'OPEN') {
      this.transitionTo('OPEN');
    }
  }

  public async execute<T>(fn: () => Promise<T>, fallbackFn?: () => T): Promise<T> {
    const currentState = this.getState();

    if (currentState === 'OPEN') {
      telemetry.track('offline_mode', {
        module: 'circuit_breaker',
        action: 'request_intercepted',
        result: 'warning',
      });

      if (fallbackFn) {
        return fallbackFn();
      }
      throw new Error('Backend circuit breaker is OPEN. Requests temporarily paused.');
    }

    try {
      const result = await fn();
      this.recordSuccess();
      return result;
    } catch (err) {
      this.recordFailure(err);
      if (fallbackFn) {
        return fallbackFn();
      }
      throw err;
    }
  }

  private transitionTo(newState: CircuitState): void {
    if (this.state === newState) return;

    console.warn(`[CircuitBreaker] Transitioning from ${this.state} to ${newState}`);
    this.state = newState;
    this.lastStateChangeTime = Date.now();

    telemetry.track('api_retry', {
      module: 'circuit_breaker',
      action: 'state_changed',
      result: newState === 'CLOSED' ? 'success' : 'warning',
      payload: { newState, failureCount: this.failureCount },
    });
  }
}

export const circuitBreaker = DashboardCircuitBreaker.getInstance();

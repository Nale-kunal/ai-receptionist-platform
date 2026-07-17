import type {
  ToolMetadata,
  ExecutionContext,
  ToolRequest,
  ToolResult,
  CircuitBreakerState,
} from './ai-tool.types';

export interface IAiTool {
  readonly metadata: ToolMetadata;
  execute(params: Record<string, any>, context: ExecutionContext): Promise<Record<string, any>>;
}

export interface IToolRegistry {
  registerTool(tool: IAiTool): void;
  deregisterTool(toolId: string, version: string): void;
  getTool(toolId: string, version: string): IAiTool | null;
  listAllTools(): IAiTool[];
}

export interface IToolDiscovery {
  discoverByName(name: string): IAiTool[];
  discoverByCategory(category: string): IAiTool[];
  discoverByTag(tag: string): IAiTool[];
  discoverByCapability(capability: string): IAiTool[];
}

export interface IToolRouter {
  route(request: ToolRequest): Promise<IAiTool>;
}

export interface IToolValidator {
  validateInput(tool: IAiTool, params: Record<string, unknown>): Record<string, unknown>;
  validateOutput(tool: IAiTool, result: Record<string, unknown>): Record<string, unknown>;
}

export interface IToolExecutor {
  execute(request: ToolRequest): Promise<ToolResult>;
}

export interface IToolResultNormalizer {
  normalizeSuccess(
    toolId: string,
    version: string,
    executionTimeMs: number,
    correlationId: string,
    result: Record<string, unknown>
  ): ToolResult;

  normalizeFailure(
    toolId: string,
    version: string,
    executionTimeMs: number,
    correlationId: string,
    error: Error
  ): ToolResult;
}

export interface IToolAuthorization {
  authorize(tool: IAiTool, context: ExecutionContext): Promise<void>;
}

export interface IToolMetricsCollector {
  trackExecution(toolId: string, version: string, latencyMs: number, success: boolean): void;
  trackRetry(toolId: string, version: string): void;
  trackTimeout(toolId: string, version: string): void;
  trackCircuitBreakerState(toolId: string, state: CircuitBreakerState): void;
  trackRateLimitingEvent(toolId: string, tenantId: string): void;
  trackAuthorizationFailure(toolId: string, tenantId: string): void;
  trackValidationFailure(toolId: string): void;
  getMetrics(): Record<string, unknown>;
}

export interface IToolAuditLogger {
  logRequested(request: ToolRequest): Promise<void>;
  logValidated(request: ToolRequest): Promise<void>;
  logExecuted(request: ToolRequest, latencyMs: number): Promise<void>;
  logFailed(request: ToolRequest, error: Error): Promise<void>;
  logRetried(request: ToolRequest, attempt: number): Promise<void>;
  logTimedOut(request: ToolRequest): Promise<void>;
  logDenied(request: ToolRequest, reason: string): Promise<void>;
  logCompleted(request: ToolRequest, result: ToolResult): Promise<void>;
}

export interface IToolIdempotencyService {
  checkIdempotency(request: ToolRequest): Promise<ToolResult | null>;
  saveExecutionResult(request: ToolRequest, result: ToolResult): Promise<void>;
}

export interface IToolRateLimiter {
  checkRateLimit(tenantId: string, clinicId: string | null, conversationId: string, toolId: string): Promise<boolean>;
}

export interface IToolCircuitBreaker {
  checkState(toolId: string): Promise<CircuitBreakerState>;
  recordSuccess(toolId: string): Promise<void>;
  recordFailure(toolId: string): Promise<void>;
}

export interface IToolTimeoutManager {
  executeWithTimeout<T>(fn: () => Promise<T>, timeoutMs: number): Promise<T>;
}

export interface IToolVersionManager {
  resolveVersion(toolId: string, requestedVersion: string): string;
}

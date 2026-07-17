import type {
  IToolExecutor,
  IToolRouter,
  IToolValidator,
  IToolResultNormalizer,
  IToolAuthorization,
  IToolMetricsCollector,
  IToolAuditLogger,
  IToolIdempotencyService,
  IToolRateLimiter,
  IToolCircuitBreaker,
  IToolTimeoutManager,
} from './ai-tool.interfaces';
import type { IAiToolEventPublisher } from './ai-tool.events';
import type { ToolRequest, ToolResult } from './ai-tool.types';
import {
  EVENT_TOOL_REQUESTED,
  EVENT_TOOL_VALIDATED,
  EVENT_TOOL_EXECUTED,
  EVENT_TOOL_FAILED,
  EVENT_TOOL_COMPLETED,
  EVENT_TOOL_DENIED,
  EVENT_TOOL_TIMEDOUT,
} from './ai-tool.events';
import {
  ValidationFailure,
  AuthorizationFailure,
  TenantFailure,
  ToolUnavailable,
} from './ai-tool.errors';

export class ToolExecutor implements IToolExecutor {
  constructor(
    private readonly router: IToolRouter,
    private readonly validator: IToolValidator,
    private readonly normalizer: IToolResultNormalizer,
    private readonly authorization: IToolAuthorization,
    private readonly metrics: IToolMetricsCollector,
    private readonly auditLogger: IToolAuditLogger,
    private readonly idempotency: IToolIdempotencyService,
    private readonly rateLimiter: IToolRateLimiter,
    private readonly circuitBreaker: IToolCircuitBreaker,
    private readonly timeoutManager: IToolTimeoutManager,
    private readonly publisher: IAiToolEventPublisher
  ) {}

  public async execute(request: ToolRequest): Promise<ToolResult> {
    const startTime = Date.now();
    const correlationId = request.context.correlationId;

    try {
      // 1. Log and publish initial requested event
      await this.auditLogger.logRequested(request);
      await this.publisher.publish({
        type: EVENT_TOOL_REQUESTED,
        payload: { request },
      });

      // 2. Resolve Tool Handler
      const tool = await this.router.route(request);

      // 3. Schema Parameter Validation
      const validatedParams = this.validator.validateInput(tool, request.parameters);
      request.parameters = validatedParams; // Override with parsed params
      
      await this.auditLogger.logValidated(request);
      await this.publisher.publish({
        type: EVENT_TOOL_VALIDATED,
        payload: { request },
      });

      // 4. Authorization, Clinic Context and Tenant boundary checks
      try {
        await this.authorization.authorize(tool, request.context);
      } catch (authErr: any) {
        this.metrics.trackAuthorizationFailure(request.toolId, request.context.tenantId);
        await this.auditLogger.logDenied(request, authErr.message);
        await this.publisher.publish({
          type: EVENT_TOOL_DENIED,
          payload: { request, reason: authErr.message },
        });
        throw authErr;
      }

      // 5. Check multi-level Rate Limiting protection bounds
      const underRateLimit = await this.rateLimiter.checkRateLimit(
        request.context.tenantId,
        request.context.clinicId,
        request.context.conversationId,
        request.toolId
      );
      if (!underRateLimit) {
        this.metrics.trackRateLimitingEvent(request.toolId, request.context.tenantId);
        const rateErr = new ValidationFailure('Rate limit exceeded for tool execution.');
        await this.auditLogger.logDenied(request, rateErr.message);
        await this.publisher.publish({
          type: EVENT_TOOL_DENIED,
          payload: { request, reason: rateErr.message },
        });
        throw rateErr;
      }

      // 6. Check Circuit Breaker status
      const breakerState = await this.circuitBreaker.checkState(request.toolId);
      if (breakerState === 'open') {
        const breakerErr = new ToolUnavailable('Tool execution blocked: circuit breaker is currently OPEN.');
        await this.auditLogger.logDenied(request, breakerErr.message);
        await this.publisher.publish({
          type: EVENT_TOOL_DENIED,
          payload: { request, reason: breakerErr.message },
        });
        throw breakerErr;
      }

      // 7. Check Idempotency Hash Store replay guards
      if (tool.metadata.idempotent) {
        const cached = await this.idempotency.checkIdempotency(request);
        if (cached) {
          const delay = Date.now() - startTime;
          this.metrics.trackExecution(request.toolId, request.version, delay, true);
          await this.auditLogger.logCompleted(request, cached);
          await this.publisher.publish({
            type: EVENT_TOOL_COMPLETED,
            payload: { request, result: cached },
          });
          return cached;
        }
      }

      // 8. Execute Tool with configured Timeout managers & Retries policies
      const maxAttempts = tool.metadata.retryPolicy?.maxRetries ?? 1;
      let attempt = 0;
      let lastError: any = null;
      let rawResult: Record<string, any> | null = null;

      while (attempt < maxAttempts) {
        attempt++;
        try {
          // Wrapped run with timeout
          rawResult = await this.timeoutManager.executeWithTimeout(
            () => tool.execute(request.parameters, request.context),
            tool.metadata.timeoutMs ?? 5000
          );
          break; // success
        } catch (err: any) {
          lastError = err;
          this.metrics.trackRetry(request.toolId, request.version);
          await this.auditLogger.logRetried(request, attempt);
          
          // Exponential backoff logic
          if (attempt < maxAttempts) {
            const backoff = (tool.metadata.retryPolicy?.backoffMs ?? 200) *
              Math.pow(tool.metadata.retryPolicy?.multiplier ?? 2, attempt - 1);
            await new Promise((resolve) => setTimeout(resolve, backoff));
          }
        }
      }

      // 9. Handle execution outcome
      if (rawResult === null) {
        // Record failure to Circuit Breaker state
        await this.circuitBreaker.recordFailure(request.toolId);
        
        throw lastError ?? new Error('Tool execution failed without diagnostic messages.');
      }

      // Record success to Circuit Breaker state
      await this.circuitBreaker.recordSuccess(request.toolId);

      // Validate Output parameters
      const validatedOutput = this.validator.validateOutput(tool, rawResult);

      // 10. Normalize Result Payload
      const executionTime = Date.now() - startTime;
      const normalized = this.normalizer.normalizeSuccess(
        request.toolId,
        request.version,
        executionTime,
        correlationId,
        validatedOutput
      );

      // Save to idempotency cache
      if (tool.metadata.idempotent) {
        await this.idempotency.saveExecutionResult(request, normalized);
      }

      this.metrics.trackExecution(request.toolId, request.version, executionTime, true);
      await this.auditLogger.logExecuted(request, executionTime);
      await this.auditLogger.logCompleted(request, normalized);

      await this.publisher.publish({
        type: EVENT_TOOL_EXECUTED,
        payload: { request, latencyMs: executionTime },
      });
      await this.publisher.publish({
        type: EVENT_TOOL_COMPLETED,
        payload: { request, result: normalized },
      });

      return normalized;

    } catch (err: any) {
      const executionTime = Date.now() - startTime;
      const normalized = this.normalizer.normalizeFailure(
        request.toolId,
        request.version,
        executionTime,
        correlationId,
        err
      );

      this.metrics.trackExecution(request.toolId, request.version, executionTime, false);
      await this.auditLogger.logFailed(request, err);
      await this.auditLogger.logCompleted(request, normalized);

      // Distinguish timeout metrics
      if (err.message.includes('timeout')) {
        this.metrics.trackTimeout(request.toolId, request.version);
        await this.publisher.publish({
          type: EVENT_TOOL_TIMEDOUT,
          payload: { request, timeoutMs: request.parameters.timeoutMs as number ?? 5000 },
        });
      }

      await this.publisher.publish({
        type: EVENT_TOOL_FAILED,
        payload: {
          request,
          error: {
            code: normalized.error?.code ?? 'INTERNAL_ERROR',
            message: err.message,
            failureClass: normalized.error?.failureClass ?? 'PermanentFailure',
          },
        },
      });
      await this.publisher.publish({
        type: EVENT_TOOL_COMPLETED,
        payload: { request, result: normalized },
      });

      return normalized;
    }
  }
}

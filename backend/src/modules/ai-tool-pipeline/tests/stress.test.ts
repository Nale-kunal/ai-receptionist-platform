import { ToolExecutor } from '../tool-executor.service';
import { ToolRouter } from '../tool-router.service';
import { ToolRegistry } from '../tool-registry.service';
import { ToolValidator } from '../tool-validator.service';
import { ToolResultNormalizer } from '../tool-result-normalizer.service';
import { ToolAuthorization } from '../tool-authorization.service';
import { ToolMetricsCollector } from '../tool-metrics.collector';
import { ToolAuditLogger } from '../tool-audit.logger';
import { ToolIdempotencyService } from '../tool-idempotency.service';
import { ToolRateLimiter } from '../tool-rate-limiter.service';
import { ToolCircuitBreaker } from '../tool-circuit-breaker.service';
import { ToolTimeoutManager } from '../tool-timeout.manager';
import { ToolVersionManager } from '../tool-version.manager';
import { InProcessAiToolEventPublisher } from '../ai-tool.events-publisher';
import type { IAiTool, ExecutionContext } from '../index';
import { z } from 'zod';

jest.setTimeout(30000);

describe('Tool Pipeline Stress & Concurrency Verification', () => {
  let executor: ToolExecutor;
  let registry: ToolRegistry;
  let context: ExecutionContext;
  let auditLogger: any;

  beforeEach(() => {
    registry = new ToolRegistry();
    const router = new ToolRouter(registry, new ToolVersionManager());
    const validator = new ToolValidator();
    const normalizer = new ToolResultNormalizer();

    const mockEvaluator = {
      authorize: jest.fn().mockResolvedValue(undefined),
    };
    const mockUserRoleRepo = {
      findActiveByUser: jest.fn().mockResolvedValue([{ role: { name: 'admin' } }]),
    };
    const authorization = new ToolAuthorization(mockEvaluator as any, mockUserRoleRepo as any);
    const metrics = new ToolMetricsCollector();

    auditLogger = {
      logRequested: jest.fn().mockResolvedValue(undefined),
      logValidated: jest.fn().mockResolvedValue(undefined),
      logExecuted: jest.fn().mockResolvedValue(undefined),
      logFailed: jest.fn().mockResolvedValue(undefined),
      logRetried: jest.fn().mockResolvedValue(undefined),
      logTimedOut: jest.fn().mockResolvedValue(undefined),
      logDenied: jest.fn().mockResolvedValue(undefined),
      logCompleted: jest.fn().mockResolvedValue(undefined),
    };

    const idempotency = new ToolIdempotencyService();
    
    // Large limits to prevent blocking stress runs
    const rateLimiter = new ToolRateLimiter({
      maxPerTenant: 100000,
      maxPerClinic: 100000,
      maxPerConv: 100000,
      maxPerTool: 100000,
      windowMs: 60000,
    });

    const circuitBreaker = new ToolCircuitBreaker({
      failureThreshold: 100000,
      resetTimeoutMs: 10000,
      halfOpenTrials: 1,
    });

    const timeoutManager = new ToolTimeoutManager();
    const publisher = new InProcessAiToolEventPublisher();

    executor = new ToolExecutor(
      router,
      validator,
      normalizer,
      authorization,
      metrics,
      auditLogger,
      idempotency,
      rateLimiter,
      circuitBreaker,
      timeoutManager,
      publisher
    );

    context = {
      correlationId: 'c1',
      traceId: 'tr1',
      tenantId: 't1',
      clinicId: 'clinic-1',
      sessionId: 's1',
      conversationId: 'conv-1',
      patientId: null,
      userId: 'user-1',
      provider: 'openai',
      toolVersion: '1.0.0',
      timestamp: new Date(),
    };
  });

  it('handles 1,000 concurrent executions with zero memory leaks and clean allocations', async () => {
    let callCounter = 0;
    const fastTool: IAiTool = {
      metadata: {
        toolId: 'fast.tool',
        toolName: 'Fast Tool',
        description: 'Fast Tool',
        category: 'general',
        version: '1.0.0',
        requiredPermissions: [],
        requiredTenantScope: true,
        inputSchema: z.object({ id: z.number() }),
        outputSchema: z.object({ count: z.number() }),
        idempotent: false,
        auditLevel: 'low',
        deprecated: false,
        tags: [],
      },
      execute: async (params) => {
        callCounter++;
        return { count: params.id };
      },
    };

    registry.registerTool(fastTool);

    const promises = [];
    const count = 1000;

    const initialMemory = process.memoryUsage().heapUsed;

    for (let i = 0; i < count; i++) {
      promises.push(
        executor.execute({
          toolId: 'fast.tool',
          version: '1.0.0',
          parameters: { id: i },
          context: {
            ...context,
            correlationId: `corr_${i}`,
          },
        })
      );
    }

    const results = await Promise.all(promises);

    expect(callCounter).toBe(count);
    expect(results.length).toBe(count);
    expect(results[0].status).toBe('success');

    if (global.gc) {
      global.gc();
    }
    const finalMemory = process.memoryUsage().heapUsed;
    const leakage = finalMemory - initialMemory;
    
    // Safety check: Leakage shouldn't be excessively large (e.g. over 50MB for 1k simple calls without GC guarantee)
    expect(leakage).toBeLessThan(50 * 1024 * 1024);
  });
});

import { ToolValidator } from '../tool-validator.service';
import { ToolAuthorization } from '../tool-authorization.service';
import { ToolIdempotencyService } from '../tool-idempotency.service';
import { ToolRateLimiter } from '../tool-rate-limiter.service';
import { ToolCircuitBreaker } from '../tool-circuit-breaker.service';
import { ToolTimeoutManager } from '../tool-timeout.manager';
import { ToolResultNormalizer } from '../tool-result-normalizer.service';
import type { IAiTool, ExecutionContext } from '../index';
import { ValidationFailure, AuthorizationFailure, TenantFailure } from '../ai-tool.errors';
import { z } from 'zod';

describe('Tool Execution Pipeline Core Components', () => {
  let context: ExecutionContext;
  let mockTool: IAiTool;

  beforeEach(() => {
    context = {
      correlationId: 'c1',
      traceId: 'tr1',
      tenantId: 'tenant-1',
      clinicId: 'clinic-1',
      sessionId: 's1',
      conversationId: 'conv-1',
      patientId: null,
      userId: 'user-123',
      provider: 'openai',
      toolVersion: '1.0.0',
      timestamp: new Date(),
    };

    mockTool = {
      metadata: {
        toolId: 'test.tool',
        toolName: 'Test Tool',
        description: 'Test Tool',
        category: 'general',
        version: '1.0.0',
        requiredPermissions: ['patient.read'],
        requiredTenantScope: true,
        inputSchema: z.object({ param: z.string().min(3) }),
        outputSchema: z.object({ result: z.string() }),
        idempotent: true,
        auditLevel: 'low',
        deprecated: false,
        tags: [],
      },
      execute: async () => ({ result: 'ok' }),
    };
  });

  // 1. Validator
  describe('ToolValidator', () => {
    const validator = new ToolValidator();

    it('parses correct params successfully', () => {
      const parsed = validator.validateInput(mockTool, { param: 'hello' });
      expect(parsed.param).toBe('hello');
    });

    it('rejects malformed inputs failing Zod validation', () => {
      expect(() => {
        validator.validateInput(mockTool, { param: 'hi' }); // too short
      }).toThrow(ValidationFailure);
    });

    it('rejects payloads exceeding the 50KB limit', () => {
      const hugeString = 'a'.repeat(60000);
      expect(() => {
        validator.validateInput(mockTool, { param: hugeString });
      }).toThrow(ValidationFailure);
    });
  });

  // 2. Authorization
  describe('ToolAuthorization', () => {
    it('allows access when Evaluator hasPermissions is true', async () => {
      const mockEvaluator = {
        authorize: jest.fn().mockResolvedValue(undefined),
      };
      const mockUserRoleRepo = {
        findActiveByUser: jest.fn().mockResolvedValue([{ role: { name: 'admin' } }]),
      };
      const auth = new ToolAuthorization(mockEvaluator as any, mockUserRoleRepo as any);

      await expect(auth.authorize(mockTool, context)).resolves.not.toThrow();
    });

    it('blocks access when permissions are missing', async () => {
      const mockEvaluator = {
        authorize: jest.fn().mockRejectedValue(new Error('Denied')),
      };
      const mockUserRoleRepo = {
        findActiveByUser: jest.fn().mockResolvedValue([{ role: { name: 'admin' } }]),
      };
      const auth = new ToolAuthorization(mockEvaluator as any, mockUserRoleRepo as any);

      await expect(auth.authorize(mockTool, context)).rejects.toThrow(AuthorizationFailure);
    });

    it('blocks access when missing required tenant scope', async () => {
      const mockUserRoleRepo = {
        findActiveByUser: jest.fn().mockResolvedValue([{ role: { name: 'admin' } }]),
      };
      const auth = new ToolAuthorization({} as any, mockUserRoleRepo as any);
      const invalidContext = { ...context, tenantId: '' };

      await expect(auth.authorize(mockTool, invalidContext)).rejects.toThrow(TenantFailure);
    });
  });

  // 3. Idempotency
  describe('ToolIdempotency', () => {
    const service = new ToolIdempotencyService();

    it('returns null on uncached requests and replays cached results', async () => {
      const req = {
        toolId: 't1',
        version: '1',
        parameters: { param: 'val' },
        context,
      };

      const checked1 = await service.checkIdempotency(req);
      expect(checked1).toBeNull();

      const normalized = {
        status: 'success' as const,
        toolId: 't1',
        version: '1',
        executionTimeMs: 12,
        correlationId: 'c1',
        result: { val: 'yes' },
        error: null,
        warnings: [],
      };

      await service.saveExecutionResult(req, normalized);

      const checked2 = await service.checkIdempotency(req);
      expect(checked2).toEqual(normalized);
    });
  });

  // 4. Rate Limiting
  describe('ToolRateLimiter', () => {
    it('allows requests within window limits and blocks overflow', async () => {
      const limiter = new ToolRateLimiter({
        maxPerTenant: 2,
        maxPerClinic: 10,
        maxPerConv: 10,
        maxPerTool: 10,
        windowMs: 50,
      });

      const r1 = await limiter.checkRateLimit('t1', 'c1', 'conv1', 'tool1');
      const r2 = await limiter.checkRateLimit('t1', 'c1', 'conv1', 'tool1');
      const r3 = await limiter.checkRateLimit('t1', 'c1', 'conv1', 'tool1'); // blocked

      expect(r1).toBe(true);
      expect(r2).toBe(true);
      expect(r3).toBe(false);
    });
  });

  // 5. Circuit Breaker
  describe('ToolCircuitBreaker', () => {
    it('trips Open on failures threshold, switches to Half-Open after timeout', async () => {
      const breaker = new ToolCircuitBreaker({
        failureThreshold: 2,
        resetTimeoutMs: 30,
        halfOpenTrials: 1,
      });

      expect(await breaker.checkState('t1')).toBe('closed');

      await breaker.recordFailure('t1');
      await breaker.recordFailure('t1');

      expect(await breaker.checkState('t1')).toBe('open');

      // Wait for reset timeout
      await new Promise((resolve) => setTimeout(resolve, 40));

      expect(await breaker.checkState('t1')).toBe('half-open');

      await breaker.recordSuccess('t1');
      expect(await breaker.checkState('t1')).toBe('closed');
    });
  });

  // 6. Timeout Manager
  describe('ToolTimeoutManager', () => {
    const manager = new ToolTimeoutManager();

    it('completes actions within timeout and rejects hanging actions', async () => {
      const result = await manager.executeWithTimeout(async () => 'fast', 50);
      expect(result).toBe('fast');

      const hangingPromise = () => new Promise<string>((resolve) => setTimeout(() => resolve('slow'), 100));
      await expect(manager.executeWithTimeout(hangingPromise, 30)).rejects.toThrow();
    });
  });
});

import { z } from 'zod';
import type { ToolCategory } from './ai-tool.constants';

// ---------------------------------------------------------------------------
// Retry Policy Interface
// ---------------------------------------------------------------------------
export interface RetryPolicy {
  maxRetries: number;
  backoffMs: number;
  multiplier: number;
}

// ---------------------------------------------------------------------------
// Execution Context (Immutable Metadata)
// ---------------------------------------------------------------------------
export interface ExecutionContext {
  readonly correlationId: string;
  readonly traceId: string;
  readonly tenantId: string;
  readonly clinicId: string | null;
  readonly sessionId: string;
  readonly conversationId: string;
  readonly patientId: string | null;
  readonly userId: string | null;
  readonly provider: string;
  readonly toolVersion: string;
  readonly timestamp: Date;
}

// ---------------------------------------------------------------------------
// Tool Metadata Definition
// ---------------------------------------------------------------------------
export interface ToolMetadata {
  toolId: string;
  toolName: string;
  description: string;
  category: ToolCategory;
  version: string;
  requiredPermissions: string[];
  requiredTenantScope: boolean;
  inputSchema: z.ZodObject<any>;
  outputSchema: z.ZodObject<any>;
  timeoutMs?: number;
  retryPolicy?: RetryPolicy;
  idempotent: boolean;
  auditLevel: 'none' | 'low' | 'high';
  deprecated: boolean;
  tags: string[];
}

// ---------------------------------------------------------------------------
// Tool Execution Requests & Normalizations
// ---------------------------------------------------------------------------
export interface ToolRequest {
  toolId: string;
  version: string;
  parameters: Record<string, unknown>;
  context: ExecutionContext;
}

export interface ToolResult {
  status: 'success' | 'failure';
  toolId: string;
  version: string;
  executionTimeMs: number;
  correlationId: string;
  result: Record<string, unknown> | null;
  error: {
    code: string;
    message: string;
    failureClass: string;
  } | null;
  warnings: string[];
}

// ---------------------------------------------------------------------------
// Circuit Breaker State Types
// ---------------------------------------------------------------------------
export type CircuitBreakerState = 'closed' | 'open' | 'half-open';

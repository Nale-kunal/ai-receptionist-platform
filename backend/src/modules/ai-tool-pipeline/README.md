# AI Tool Execution Pipeline Module (Enterprise)

## Purpose

The **AI Tool Execution Pipeline** is the secure gateway governing every operation requested by the AI Engine. No direct imports of business services are allowed; all mutations flow through this validation, rate-limiting, and auditing pipeline.

---

## 1. Directory Structure

```text
ai-tool-pipeline/
├── ai-tool.constants.ts            # Configuration constants (categories, thresholds)
├── ai-tool.types.ts                # Context, ToolMetadata, and Result definitions
├── ai-tool.errors.ts               # Custom failure classification hierarchy
├── ai-tool.interfaces.ts           # Interfaces & Contracts
├── ai-tool.events.ts               # strongly-typed audited domain events
├── ai-tool.events-publisher.ts     # prioritized nextTick dispatcher
├── enterprise-tools.ts             # Contains the 20 implementation classes of enterprise tools
├── tool-idempotency.service.ts     # replay safeguards using crypto hashes
├── tool-rate-limiter.service.ts     # multi-level sliding window rate limiting
├── tool-circuit-breaker.service.ts  # Trips tool execution under errors (Closed -> Open)
├── tool-timeout.manager.ts         # Graceful timeout cancellations
├── tool-version.manager.ts         # semantic version resolver
├── tool-metrics.collector.ts       # latencies and breaker counters
├── tool-audit.logger.ts            # writes sanitized records to Prisma DB
├── tool-validator.service.ts       # parses params with zod inputs/outputs
├── tool-authorization.service.ts   # RBAC permissions and tenant boundaries
├── tool-result-normalizer.service.ts # standard outcome wrappers
├── tool-registry.service.ts        # in-memory registry manager
├── tool-discovery.service.ts       # capability searches
├── tool-router.service.ts          # request router mapping
├── tool-executor.service.ts        # maps sequential pipeline operations
├── tool.middleware.ts              # Express context compiler
├── tool.dto.ts                     # REST structures
├── tool.validators.ts              # Express Zod payload checks
├── tool.controller.ts              # Controller callbacks
├── tool.routes.ts                  # express router triggers
├── index.ts                        # barrel exports
└── README.md                       # documentation
```

---

## 2. Dynamic Tool Extensibility

To extend the initial set and add a new tool:
1. Implement the `IAiTool` interface:
```typescript
import { z } from 'zod';
import type { IAiTool, ExecutionContext } from './index';

export class NewSpecializedTool implements IAiTool {
  public readonly metadata = {
    toolId: 'clinic.specialized_action',
    toolName: 'Specialized Action',
    description: 'Execute custom work.',
    category: 'clinic' as const,
    version: '1.0.0',
    requiredPermissions: ['clinic.read'],
    requiredTenantScope: true,
    inputSchema: z.object({ param1: z.string() }),
    outputSchema: z.object({ success: z.boolean() }),
    idempotent: true,
    auditLevel: 'low' as const,
    deprecated: false,
    tags: ['custom'],
  };

  public async execute(params: any, context: ExecutionContext): Promise<any> {
    return { success: true };
  }
}
```
2. Register it with the `ToolRegistry` instance. No core executor changes are necessary.

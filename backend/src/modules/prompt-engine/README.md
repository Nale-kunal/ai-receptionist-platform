# Prompt Engine Module

## Purpose

The Prompt Engine manages all AI prompt lifecycle operations: versioning, publishing, rollback, variable interpolation, caching, and composition. It is the sole authority over what instructions are delivered to the AI Engine.

## Architecture

```
PromptEngineController
    → PromptEngineService (orchestration)
        → PromptTemplateRepository (Prisma)
        → PromptAuditLogRepository (Prisma)
        → PromptCacheService (in-memory, no TTL)
        → PromptComposerService (pure composition)
            → PromptVariableResolverService ({{variable}} interpolation)
        → InProcessPromptEngineEventPublisher
```

## Supported Prompt Types

| Type | Purpose |
|---|---|
| `system` | Main AI personality and instruction set |
| `greeting` | Initial caller greeting |
| `fallback` | Unclear/out-of-scope query response |
| `booking` | Appointment booking flow |
| `cancellation` | Cancellation flow |
| `rescheduling` | Rescheduling flow |
| `faq` | Frequently asked questions |
| `after_hours` | After hours message |
| `emergency` | Emergency escalation protocol |
| `goodbye` | Call ending |

## Prompt Lifecycle

```
Draft → Published → Archived
         ↓
    Rollback (creates a new Published version from any historical version)
```

## Variable Interpolation

Prompts support 15 whitelisted `{{variables}}`. Unknown variables block publishing.

## Security

- No API keys, passwords, or secrets permitted in prompt content (validated at publish)
- System prompts are never returned in REST responses
- All endpoints require authentication + tenant resolution + RBAC permission check
- Tenant isolation enforced on every operation

## REST Endpoints

```
POST   /api/v1/prompt-engine/prompts
GET    /api/v1/prompt-engine/prompts
GET    /api/v1/prompt-engine/prompts/:id
PATCH  /api/v1/prompt-engine/prompts/:id
POST   /api/v1/prompt-engine/prompts/:id/publish
POST   /api/v1/prompt-engine/prompts/:id/archive
POST   /api/v1/prompt-engine/prompts/:id/rollback
GET    /api/v1/prompt-engine/prompts/:id/history
POST   /api/v1/prompt-engine/compose
GET    /api/v1/prompt-engine/audit-logs
```

## AI Engine Integration

`AiEngineService` accepts an optional `IPromptEngineService` dependency. When provided, the system prompt is sourced from Prompt Engine (with graceful fallback to the inline builder). This replaces the previous hardcoded `buildSystemPrompt()` stub.

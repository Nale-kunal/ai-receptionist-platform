# Architecture Freeze v1 — AI Receptionist SaaS Platform

**Status**: FROZEN  
**Version**: 1.0.0  
**Effective Date**: 2026-07-16  
**Next Review**: Only on security vulnerability, correctness issue, scalability limitation, or production defect

---

## 1. Purpose

This document officially freezes the platform architecture at version 1. All future work MUST extend this architecture, not redesign it. Any proposed structural change requires explicit justification against one of the four allowed reasons listed above and must be accompanied by a new ADR (Architecture Decision Record).

---

## 2. System Architecture

```
Telephony Provider (Twilio, etc.)
         │
         ▼
   Voice Server
         │  Transport layer only. No business logic.
         ▼
Realtime AI Adapter
         │  Provider abstraction. Normalizes all realtime protocols.
         ▼
Conversation Orchestrator
         │  Runtime coordination. State machine. Recovery.
         ▼
     AI Engine
         │  Provider-agnostic LLM orchestration.
         ▼
AI Tool Execution Pipeline
         │  Secure, validated, rate-limited tool gateway.
         ▼
  Prompt Engine
         │  Prompt composition and versioning.
         ▼
Business Services
         │  Domain logic: Appointments, Patients, Clinics, etc.
         ▼
   Repositories
         │  Prisma-based persistence layer.
         ▼
    PostgreSQL
```

---

## 3. Module Responsibilities

| Module | Responsibility | Owns |
|--------|---------------|------|
| **Voice Server** | Telephony transport. Receive/forward audio streams. Call lifecycle. | WebSocket/SIP sessions |
| **Realtime AI Adapter** | Abstract provider protocols. Session state. Normalize provider events. | Provider session registry |
| **OpenAI Realtime Provider** | Concrete IRealtimeAiProvider. OpenAI WebSocket lifecycle only. | WS connection per session |
| **Conversation Orchestrator** | Runtime coordination of a live call. Barge-in. Recovery. Timeouts. | Orchestration state machine |
| **AI Engine** | LLM conversation management. Context. Token management. | Conversation context |
| **AI Tool Execution Pipeline** | Validate, rate-limit, audit, execute tool calls from AI. | Tool registry & executor |
| **Prompt Engine** | Compose, version, cache system prompts. | Prompt templates & versions |
| **Clinic** | Clinic management. Business hours. Settings. | Clinic entity |
| **Doctor** | Doctor profiles. Working hours. Leaves. | Doctor entity |
| **Patient** | Patient records. Preferences. | Patient entity |
| **Appointment** | Booking, cancellation, rescheduling. Availability. | Appointment entity |
| **Conversation** | Conversation records. Transcript storage. | Conversation entity |
| **Notification** | SMS, email delivery. Templates. Queuing. | Notification entity |
| **Calendar** | Calendar events mirroring appointments. | Calendar entity |
| **RBAC** | Role-based access control. Permissions. | Role/Permission entities |
| **Authentication** | JWT issuance, refresh, revocation. | Auth tokens |
| **Tenant** | Multi-tenant isolation. Tenant management. | Tenant entity |
| **Configuration** | Feature flags, system settings per tenant/clinic. | Config entity |

---

## 4. Allowed Dependencies

Dependencies flow strictly downward. No upward dependencies allowed.

```
Voice Server
  → Realtime AI Adapter

Realtime AI Adapter
  → (OpenAI Realtime Provider plugin)
  → Conversation (read-only: conversationId linkage)

OpenAI Realtime Provider
  → Realtime AI Adapter interfaces only (IRealtimeAiProvider)

Conversation Orchestrator
  → Realtime AI Adapter
  → AI Engine
  → Conversation (service)

AI Engine
  → Prompt Engine
  → AI Tool Execution Pipeline

AI Tool Execution Pipeline
  → Appointment (service)
  → Patient (service)
  → Doctor (service)
  → Clinic (service)
  → Conversation (service)
  → Notification (service)
  → RBAC (permission evaluator)

Prompt Engine
  → Configuration
  → Clinic (read-only)

Business Services (Appointment, Patient, etc.)
  → Repositories
  → RBAC (for permission enforcement)
  → Notification (for side-effect notifications)

RBAC
  → Repositories

Authentication
  → Tenant
  → RBAC

Tenant
  → Repositories

Configuration
  → Repositories
```

---

## 5. Forbidden Dependencies

These dependency paths are PERMANENTLY FORBIDDEN. Any code violating these rules is a critical architecture defect.

| Forbidden | Reason |
|-----------|--------|
| AI Engine → Business Services (direct) | All AI→business calls MUST flow through the Tool Pipeline |
| AI Engine → Repositories (direct) | AI must never read/write database directly |
| Prompt Engine → Business Services | Prompt Engine composes prompts only; no domain logic |
| Voice Server → AI Engine | VS is transport only; cannot orchestrate AI |
| Voice Server → Business Services | VS has no business context |
| Realtime AI Adapter → Business Services | Adapter normalizes protocols only |
| OpenAI Realtime Provider → Business Services | Provider is a network plugin, not a business actor |
| OpenAI Realtime Provider → AI Engine | Provider communicates events upward through the adapter interface |
| Business Services → AI Engine | Business logic is synchronous; AI is async infrastructure |
| Business Services → Voice Server | No upward dependency |
| Any Module → Authentication internals | Auth is only consumed via JWT middleware |
| Any Module → Raw Prisma (outside repositories) | All DB access goes through repositories |
| AI Tool Execution Pipeline → Repositories (direct) | Pipeline uses services, not repositories directly |

---

## 6. Public Interfaces

Each module exposes ONLY these public surfaces. Internal implementation details are module-private.

### Voice Server
- `IVoiceSessionManager` — create/end call sessions
- `IVoiceEventPublisher` — publish call events

### Realtime AI Adapter
- `IRealtimeAiProvider` — provider plugin contract
- `IRealtimeAiProviderFactory` — factory for provider instances
- `IRealtimeSessionManager` — session CRUD and state
- `IRealtimeEventRouter` — route normalized events
- `IRealtimeMetricsCollector` — telemetry
- `IRealtimeAuditLogger` — audit logging

### OpenAI Realtime Provider
- `OpenAiRealtimeProvider` (implements `IRealtimeAiProvider`) — only public export

### Conversation Orchestrator
- `IConversationOrchestrator` — lifecycle operations
- `IOrchestratorEventPublisher` — domain events

### AI Engine
- `IAiEngine` — process conversation turns

### AI Tool Execution Pipeline
- `IToolExecutor` — execute tool requests
- `IToolRegistry` — register/list tools
- `IToolDiscovery` — search tools
- `IAiTool` — tool implementation contract

### Prompt Engine
- `IPromptEngine` — build system prompts

### Business Services (all similar pattern)
- `IClinicService`, `IDoctorService`, `IPatientService`, `IAppointmentService`, `IConversationService`, `INotificationService`

### RBAC
- `IPermissionEvaluator` — authorization checks

### Authentication
- `IAuthService` — login, refresh, logout

---

## 7. Architectural Invariants

These properties MUST hold at all times. Any change that breaks an invariant requires re-architecture (subject to freeze override rules).

1. **Tenant Isolation**: Every database query MUST include a `tenantId` filter. Cross-tenant data access is a critical security defect.

2. **Provider Agnosticism**: The AI Engine, Conversation Orchestrator, Voice Server, and Tool Pipeline MUST NOT contain any provider-specific code (OpenAI, Twilio, Gemini, etc.).

3. **Tool Pipeline Gatekeeping**: The AI Engine MUST NEVER call business services directly. All tool-triggered mutations MUST flow through the AI Tool Execution Pipeline.

4. **Event Normalization**: Raw provider events (OpenAI WebSocket frames, Twilio TwiML, etc.) MUST be normalized before leaving their respective provider module. Normalized types are defined in the Realtime AI Adapter layer.

5. **Audit Completeness**: Every AI tool execution, provider session creation, state transition, and authorization check MUST produce an audit record in `AiAuditLog`.

6. **PHI/Secret Redaction**: No audit logger, metrics collector, or error handler MAY log raw PHI (patient name, DOB, SSN, phone), API keys, audio payloads, or tokens.

7. **Repository Isolation**: Only repository classes access Prisma directly. No service, engine, or provider may import `PrismaClient` directly.

8. **Stateless Services**: Business services, the AI Engine, and the Tool Pipeline MUST be stateless (no in-memory session state across requests). State is persisted to PostgreSQL.

9. **Circuit Breaker on Providers**: All external provider connections (OpenAI, Twilio, etc.) MUST have a circuit breaker protecting the platform from provider outages.

10. **Horizontal Scalability**: No in-process shared mutable state between requests. All coordination uses the database. Supports N replicas.

---

## 8. Layer Boundaries

```
┌───────────────────────────────────────────────────────┐
│  INFRASTRUCTURE LAYER                                  │
│  Voice Server · Realtime AI Adapter · Provider Plugins │
│  (transport, protocol, provider-specific I/O)          │
└───────────────────────────────────────────────────────┘
                         ↓
┌───────────────────────────────────────────────────────┐
│  ORCHESTRATION LAYER                                   │
│  Conversation Orchestrator · AI Engine                 │
│  (runtime state, context management, coordination)     │
└───────────────────────────────────────────────────────┘
                         ↓
┌───────────────────────────────────────────────────────┐
│  GATEWAY LAYER                                         │
│  AI Tool Execution Pipeline · Prompt Engine            │
│  (validation, composition, secure tool dispatch)       │
└───────────────────────────────────────────────────────┘
                         ↓
┌───────────────────────────────────────────────────────┐
│  DOMAIN LAYER                                          │
│  Clinic · Doctor · Patient · Appointment               │
│  Conversation · Notification · Calendar                │
│  (business rules, domain events, state machines)       │
└───────────────────────────────────────────────────────┘
                         ↓
┌───────────────────────────────────────────────────────┐
│  PERSISTENCE LAYER                                     │
│  Repositories · Prisma · PostgreSQL                    │
│  (data access, migrations, transactions)               │
└───────────────────────────────────────────────────────┘

Cross-cutting:
┌───────────────────────────────────────────────────────┐
│  Authentication · RBAC · Tenant · Configuration        │
│  (identity, authorization, multi-tenancy, settings)    │
└───────────────────────────────────────────────────────┘
```

---

## 9. Extension Points

New functionality MUST be added through these defined extension points. No new architectural layers should be created.

| Extension Point | How to Extend |
|----------------|--------------|
| **New AI Provider** | Implement `IRealtimeAiProvider`, register in `RealtimeAiProviderFactory` |
| **New Telephony Provider** | Implement voice transport adapter, plug into Voice Server |
| **New AI Tool** | Implement `IAiTool`, register in `ToolRegistry` |
| **New Business Domain** | Add service implementing domain interface, repository, Prisma model |
| **New Notification Channel** | Implement `INotificationProvider`, register in NotificationService |
| **New Prompt Template** | Add template to PromptEngine template registry |
| **New RBAC Permission** | Add permission constant, update role definitions |
| **New Tenant Industry** | Configure via tenant metadata; no code changes required for core system |

---

## 10. Plugin Interfaces

| Plugin Type | Contract Interface | Registration Point |
|-------------|------------------|-------------------|
| Realtime AI Provider | `IRealtimeAiProvider` | `RealtimeAiProviderFactory` |
| Notification Provider | `INotificationProvider` | `NotificationService` constructor |
| AI Tool | `IAiTool` | `ToolRegistry.registerTool()` |
| Voice Transport | (future) `IVoiceTransport` | Voice Server factory |

---

## 11. Future Scalability Assumptions

The architecture is designed to scale horizontally to thousands of concurrent clinics without structural changes.

| Assumption | Implementation |
|-----------|---------------|
| Stateless replicas | Services hold no in-memory state between requests |
| Tenant sharding ready | `tenantId` is on every entity; DB can be sharded by tenant |
| Provider hot-swap | Provider factory allows runtime provider swapping |
| Tool registry runtime extension | Tools can be registered/deregistered without restart |
| Event-driven loose coupling | Domain events published async via publishers |
| PostgreSQL connection pooling | Prisma connection pooler supported |
| Horizontal session scaling | WebSocket sessions managed per-replica; sticky sessions via load balancer |
| Read replicas | Repository layer supports read/write separation |
| Queue-based notification delivery | Notification service designed for async queue integration |
| Metrics export ready | Metrics collectors expose data for Prometheus/Datadog |

---

## 12. Security Invariants

1. All endpoints require JWT authentication (except `/health`, `/auth/login`)
2. All JWT tokens include `tenantId` and `clinicId` claims
3. Every authorization check uses `PermissionEvaluatorService.authorize()`
4. RBAC: default-deny (must have explicit grant)
5. No API keys stored in code — loaded from environment/config at runtime
6. All PHI fields encrypted at rest (via PostgreSQL column encryption)
7. Audit log immutable — append-only, no deletes
8. Rate limiting on all AI tool executions and provider sessions
9. Circuit breakers on all external provider connections

---

## 13. Modification Protocol

Architecture changes are prohibited unless one of the following is true:

1. **Security vulnerability** — a CVE or audit finding requires structural change
2. **Correctness issue** — a bug proves the architecture is unsound
3. **Scalability limitation** — proven at scale (not speculative)
4. **Production defect** — a defect in production requires architectural fix

All approved changes require:
- A new ADR (0018+) documenting context, decision, and consequences
- Update to this document
- Review and approval
- Regression testing of all existing modules

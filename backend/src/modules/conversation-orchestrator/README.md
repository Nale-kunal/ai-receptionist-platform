# Conversation Orchestrator Module (Enterprise)

## Purpose

The **Conversation Orchestrator** is the enterprise runtime coordinator for live conversations, managing state transitions, turn ordering, transcript accumulations, fault recovery, resource leak prevention, and multi-tenant rate limits.

---

## 1. Directory Structure

```text
conversation-orchestrator/
├── conversation-orchestrator.constants.ts           # Lifecycles, timeouts, rate bounds
├── conversation-orchestrator.types.ts               # Context, Turn, and Correlation definitions
├── conversation-orchestrator.errors.ts              # Custom exceptions and failures hierarchy
├── conversation-orchestrator.interfaces.ts          # Module code contracts and lock providers
├── conversation-orchestrator.events.ts              # Strongly-typed audited domain events
├── conversation-orchestrator-event.publisher.ts    # Prioritized event dispatcher
├── conversation-recovery.manager.ts                 # Reconnect checkpoint recovery manager
├── conversation-snapshot.manager.ts                 # Immutable state snapshot manager
├── runtime-resource.manager.ts                      # Leak-free timer/listener manager
├── orchestration-session.model.ts                   # Immutable session data model
├── orchestration-session.state-machine.ts           # transition flow checks
├── turn.manager.ts                                  # User/Assistant speech turn tracking
├── transcript.manager.ts                            # Real-time dialogue aggregation
├── context.synchronizer.ts                          # Context metadata synchronization
├── conversation-orchestrator.service.ts            # Coordinates all services
├── conversation-orchestrator.security.validator.ts  # Tenant context validation and PHI redaction
├── conversation-orchestrator.metrics.collector.ts   # Observability and stats
├── conversation-orchestrator.audit.logger.ts        # Prisma DB audit log writer
├── conversation-orchestrator.validators.ts          # Zod validation schemas
├── conversation-orchestrator.dto.ts                 # DTO formats
├── conversation-orchestrator.controller.ts          # Express HTTP Controller
├── conversation-orchestrator.routes.ts              # Express routes mapping
├── index.ts                                         # Barrel exports
└── README.md                                        # Documentation
```

---

## 2. Event Ordering Priority

Audited domain events are processed deterministically inside the prioritized `InProcessOrchestratorEventPublisher` using this priority hierarchy:

1. **Critical Failure**: `conversation.failed`
2. **Disconnect / Timeout**: `conversation.timeout`
3. **Barge-in Interruption**: `conversation.interrupted`, `conversation.resumed`
4. **Transcript**: `conversation.turn.started`, `conversation.turn.completed`
5. **AI Responses**: `conversation.response.generated`
6. **Observability**: `conversation.snapshot.created`

---

## 3. Distributed Lock & Snapshot Extensions

To scale this module across multiple stateless containers, developers can implement the abstract system interfaces:
- `IConversationLockProvider`: Acquire locks via Redis or PostgreSQL advisory locks.
- `IConversationSnapshotStore`: Persist snapshot arrays to Redis or NATS.
- `IConversationRecoveryProvider`: Register session token expirations.

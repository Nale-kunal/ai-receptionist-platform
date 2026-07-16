# ADR 0008: Business Logic is Isolated from Infrastructure Modules

## Status
Accepted

## Context
Infrastructure modules handle high-performance protocols, network packets, WebSockets, and media pipelines. Mixing scheduling, billing, or tenant business rules here results in complex dependencies.

## Decision
All business logic is isolated in core backend services. Infrastructure modules (like `VoiceServer`, `RealtimeAiAdapter`, `ConversationOrchestrator`) are restricted to transport, framing, and routing operations, and are prohibited from querying repositories or mutating business entities.

## Consequences
- **Pros**: Independent scaling, clean testing, stable infrastructure.
- **Cons**: Requires structured events and API layers to invoke business transactions.

## Alternatives Considered
- Sharing database models and repositories inside the Voice Server package. Rejected as it violates modular cohesion.

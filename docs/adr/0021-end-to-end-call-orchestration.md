# ADR-0021: End-to-End Call Orchestration

**Status**: Accepted  
**Date**: 2026-07-17

## Context

The platform must coordinate multiple specialized infrastructure modules (telephony, voice server, real-time AI, tool execution pipeline, business services) into a single, cohesive call experience. 
If each module tries to directly invoke others, it creates tight coupling (spaghetti code) and makes testing/observability extremely hard.

## Decision

We introduce the `end-to-end` orchestration module to coordinate all modules into a single deterministic conversation.

- It initializes the runtime context and mappings between Call SID, Voice Session, and Real-time AI Session.
- It acts as the single central hub forwarding events (such as speech detection, VAD, and interruptions) across boundaries.
- No business logic or vendor-specific protocols live in the coordinator; it strictly manages flow.

## Alternatives Considered

1. **Chained Event Dispatching**: Allowing Twilio provider to call voice server, which directly triggers real-time adapter, which triggers tool execution, etc. Rejected. This makes handling timeouts, retries, and errors extremely fragile.
2. **Central orchestrator with business rules**: Rejected. Keeping it transport-agnostic and logic-free keeps components clean.

## Consequences

- Clean separation of concerns.
- Easy testing using mock provider adapters.

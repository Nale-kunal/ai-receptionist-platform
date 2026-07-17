# ADR-0022: Call Flow Single Source of Truth

**Status**: Accepted  
**Date**: 2026-07-17

## Context

A call consists of multiple concurrent sessions: a Twilio Call SID, a Voice Server session, a Realtime AI session, and a database Conversation record. Storing state fragmentations in different modules introduces synchronization issues, orphaned sockets, and race conditions.

## Decision

The `CallFlowCoordinator` and `CallSessionManager` are established as the **single source of truth** for call sessions.

- Any state transition, lifecycle change, or error teardown must flow through the coordinator.
- Mappings between SIDs, voice tokens, and socket references are kept in the `CallSessionManager`.
- Upon hangup or timeout, the coordinator drives the cleanup of all underlying sessions deterministically.

## Alternatives Considered

1. **Distributed State Tracking**: Letting each module handle its own cleanup. Rejected because socket leaks could occur if one layer fails silently.

## Consequences

- 100% leak-free session tear downs.
- Transparent observability of active conversations.

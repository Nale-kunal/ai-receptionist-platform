# ADR 0009: Conversation Runtime Recovery

## Status
Accepted

## Context
In real-time multi-tenant telephony, network failures (websocket disconnects, provider glitches, server switches) are inevitable. If the system drops the call transcript or turn state during reconnects, it violates HIPAA/SOC2 compliance, corrupts auditing, and ruins patient experience.

## Decision
We implement a `ConversationRecoveryManager` and `ConversationSnapshotManager` inside the `ConversationOrchestrator` to capture checkpoints of active sessions (transcripts, turns, context, variables) and restore them deterministically on reconnect without duplicating audio responses.

## Consequences
- **Pros**: Fault tolerance under network storms, preservation of caller context, compliant audit logs.
- **Cons**: Overhead from snapshot serialization/deserialization.

## Alternatives Considered
- Simple state reset on disconnect. Rejected because it destroys call state and duplicates greetings.

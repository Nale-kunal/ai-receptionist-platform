# ADR-0023: Tool Pipeline Required for Business Actions

**Status**: Accepted  
**Date**: 2026-07-17

## Context

When the AI assistant decides to book, reschedule, or cancel appointments, it triggers function calls. Bypassing the execution pipeline to directly call business services would lose audit trails, correlation IDs, and tenant isolation checks.

## Decision

Every function call requested by the real-time AI provider MUST route through the **AI Tool Execution Pipeline**:

- The coordinator maps the function request to the execution pipeline.
- The pipeline validates tenant/user authorization, records audit logs, executes the service, and returns a normalized payload.
- The results are returned to the AI provider to maintain clean history records.

## Alternatives Considered

1. **Direct execution in orchestrator**: Rejected. Bypasses security parameters.

## Consequences

- Full auditing of all clinic actions.
- Secure tenant isolation.

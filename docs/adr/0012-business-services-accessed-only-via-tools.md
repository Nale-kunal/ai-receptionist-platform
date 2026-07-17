# ADR 0012: Business Services Accessed Only Via Tools

## Status
Accepted

## Context
Exposing business services directly to AI engines allows unrestricted command execution, bypassing schema validations, context isolation parameters, and permission logic.

## Decision
We enforce the restriction that business services can only be accessed by the AI engine through registered tool definitions. Direct calls are prohibited, and every service interaction is mapped to a schema-verified and authorized tool.

## Consequences
- **Pros**: Complete validation of input variables, consistent telemetry logs, preventing unauthorized updates.
- **Cons**: Requires registering and updating metadata declarations for every business workflow.

## Alternatives Considered
- Direct service calls. Rejected as unsafe.

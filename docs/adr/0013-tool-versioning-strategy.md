# ADR 0013: Tool Versioning Strategy

## Status
Accepted

## Context
AI prompt behaviors and tool outputs change over time. Silently changing tool logic can cause model confusion, leading to broken call dialog flows.

## Decision
We implement strict semantic tool versioning (e.g. `v1`, `v2`). The AI Engine requests tools by version, and the registry resolves the specific handler matching the requested version. Backward compatibility is maintained dynamically.

## Consequences
- **Pros**: Risk-free deployment of new tool logic, safe transitions, clean legacy compatibility.
- **Cons**: Code duplicate management when maintaining multiple active versions.

## Alternatives Considered
- Single active version with dynamic prompts. Rejected as it introduces unexpected regressions in production.

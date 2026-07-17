# ADR 0011: AI Tool Execution Pipeline

## Status
Accepted

## Context
In an enterprise multi-tenant SaaS, direct interactions between the generative AI Engine and core business logic or databases present high security risks, race conditions, parameter validation vulnerabilities, and rate-limiting failure issues. A centralized gateway is required to secure and validate all AI-triggered operations.

## Decision
We implement a dedicated, flat `ai-tool-pipeline` module that acts as the exclusive orchestrator for AI tool executions. All tool requests pass through standard sequential validation, permission scopes, tenant isolation checks, rate limiting, per-tool circuit breakers, timeout limits, idempotency guards, and result normalizations before invoking business modules.

## Consequences
- **Pros**: Strong protection of internal databases, HIPAA/SOC2 compliance, resilience against cascading failures, centralized execution logging.
- **Cons**: Minor latency overhead from pipeline checks.

## Alternatives Considered
- Direct business module imports by AI Engine. Rejected as it breaches tenant boundary scopes.

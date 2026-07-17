# ADR-0025: Observability Architecture

**Status**: Accepted  
**Date**: 2026-07-17

## Context

A production SaaS serving dental clinics requires real-time health checks, metrics, and incident audits.

## Decision

We introduce standard metrics and structured logging guidelines:

- **Metrics**: Expose Prometheus `/metrics` endpoints from the Voice Server and Backend (using `prom-client` or similar) to monitor latency distributions, socket active counts, and queue lags.
- **Structured Logs**: All logs must be output in JSON format containing a standard context schema: `correlationId`, `sessionId`, `tenantId`, `userId`, and `action`.
- **Health Checks**: Containers must implement `/health` and `/ready` probes.

## Alternatives Considered

1. **Ad-hoc Console Logs**: Hard to filter, parse, and scan in production.
2. **Proprietary Monitoring Agents**: Vendor lock-in; open-source Prometheus standards are preferred.

## Consequences

- Direct integration with Grafana dashboard stacks.
- Immediate alerting on webhook or stream routing errors.

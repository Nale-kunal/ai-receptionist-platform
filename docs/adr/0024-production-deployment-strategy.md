# ADR-0024: Production Deployment Strategy

**Status**: Accepted  
**Date**: 2026-07-17

## Context

The platform must run in a secure, scalable, and reproducible environment. We must package and deploy the three main system components (backend API, voice stream server, and react dashboard frontend) cleanly.

## Decision

We adopt a **container-based deployment strategy** using multi-stage Dockerfiles and Nginx reverse proxies:

- **Backend Container**: Multi-stage node Alpine image running compiled production Javascript and Prisma engine client.
- **Voice Server Container**: Multi-stage Node Alpine image listening on port 5000, supporting duplex WS stream connections.
- **Frontend Container**: Served via a production Nginx Alpine server.
- **Root Nginx Reverse Proxy**: Orchestrates TLS/HTTPS terminations, routes `/api/` requests to the Backend, `/voice-stream` to the Voice Server, and all other routes to the static React Frontend.

## Alternatives Considered

1. **Bare Metal Node Processes**: Hard to manage environment isolation and scaling.
2. **Serverless Functions**: Inbound persistent WebSockets for live voice streaming require stateful connections, making serverless a poor fit.

## Consequences

- Easily orchestratable via Docker Compose locally and ECS/K8s in cloud environments.
- Predictable production builds.

# ADR-0026: Graceful Shutdown Handling

**Status**: Accepted  
**Date**: 2026-07-17

## Context

When upgrading versions or scaling down nodes, dropping active phone calls or database transactions mid-flight ruins clinic client operations and causes data corruption.

## Decision

We implement a **graceful shutdown protocol**:

- Intercept `SIGTERM` and `SIGINT` signals.
- In the Backend: Stop accepting new requests, complete active HTTP requests, close the database connection pool, and exit with code 0.
- In the Voice Server: Signal Twilio active stream instances of shutdown, complete running TTS speech sentences, tear down WebSocket sessions cleanly, and exit with code 0.
- The process must timeout and force kill (exit code 1) after 30 seconds if active sockets fail to close.

## Consequences

- No orphan calls or database transaction leaks.
- Zero-downtime rolling upgrades.

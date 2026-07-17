# ADR-0020: Provider as Transport Layer Only

**Status**: Accepted  
**Date**: 2026-07-17

## Context

Telephony providers parse incoming media streams, packet headers, call state callbacks, and DTMF tones. Since this provider interfaces directly with external networks, there is a risk of domain logic leaking into it (for instance, looking up clinic hours, checking doctor availability, or saving database records directly during call answer). 
Leaking domain logic into transport plugins creates coupling and violates provider-agnostic invariants.

## Decision

The Twilio Voice Provider is strictly a **transport-only layer**:

- **No Business Logic**: It does not query database tables, authenticate clinics, or coordinate scheduling.
- **Audio Framing**: It parses raw binary payload packages, normalizes them, and delegates processing to the internal `MediaPipeline`.
- **Event Forwarding**: It normalizes vendor-specific signals (such as DTMF packet `media` frames, WebSocket `disconnect`, silence patterns) into neutral internal platform events.
- **Independence**: Call routing is coordinated by the `ConversationOrchestrator` using normalized events, keeping the telephony provider lightweight and replaceable.

## Alternatives Considered

1. **Inline Business Hook execution**: Rejected. Violates separation of concerns.

## Consequences

- Easy maintenance of provider plugins.
- Test suites can mock network streams without requiring a PostgreSQL database or active AI model context.

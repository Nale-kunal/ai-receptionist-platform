# ADR 0004: Realtime AI Adapter Owns Provider Protocol

## Status
Accepted

## Context
Telephony streams need to connect to realtime LLM sockets (e.g. OpenAI Realtime WebSockets). Hardcoding vendor-specific protocol translation inside the transport layer makes the platform rigid.

## Decision
The `RealtimeAiAdapter` module isolates all provider-specific realtime protocol translations. It implements a provider-neutral adapter layer (`IRealtimeAiProvider`) that wraps connection handshakes, heartbeats, and payload mapping.

## Consequences
- **Pros**: Provider switches can be implemented without affecting the transport layer or AI Engine.
- **Cons**: Introducing abstraction maps for audio buffers and event types increases structure complexity.

## Alternatives Considered
- Standardizing on Twilio Media Streams and writing OpenAI Realtime parsing directly in `VoiceServer`. Rejected as it violates the provider-independence objective.

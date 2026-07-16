# ADR 0003: Voice Server Owns Transport Only

## Status
Accepted

## Context
Real-time call streaming involves high-concurrency websocket management, audio framing, packet drops, and codec transformations. Embedding business decisions in this layer degrades performance and violates separation of concerns.

## Decision
The `VoiceServer` module is restricted to connection transport, frame buffering, and packet sequencing. It streams audio data and forwards session events without executing any AI operations or business transactions.

## Consequences
- **Pros**: Optimized, high-performance transport pipeline, highly reusable across different telephony providers.
- **Cons**: Requires standard domain events to bridge messages to the orchestrator layer.

## Alternatives Considered
- Running the AI model completion loops directly inside the WebSocket stream handlers. Rejected due to latency spikes and high resource contention.

# ADR-0015: OpenAI Realtime Provider as an Isolated Plugin

**Status**: Accepted  
**Date**: 2026-07-16

## Context

The platform requires a concrete integration with OpenAI's Realtime API to enable voice-based AI conversations. The existing `IRealtimeAiProvider` interface in the Realtime AI Adapter module defines the exact contract any provider must implement. OpenAI's Realtime API uses a WebSocket protocol with provider-specific message schemas, event types, session configuration, and audio encoding.

The question is: how do we add OpenAI support without coupling the core platform to OpenAI's implementation details?

## Decision

The OpenAI Realtime Provider is implemented as a **self-contained plugin module** (`openai-realtime/`) that implements `IRealtimeAiProvider` and nothing else. The plugin:

- Lives in its own module directory with a flat file structure
- Has zero knowledge of business domain logic
- Has zero knowledge of conversation orchestration
- Has zero knowledge of prompt composition
- Exposes only its `OpenAiRealtimeProvider` class externally
- Is registered in `RealtimeAiProviderFactory` by provider type `'openai'`
- Can be replaced, disabled, or swapped with a different OpenAI version without changing any other module

## Alternatives Considered

1. **Embed OpenAI code in Realtime AI Adapter**: Rejected. Would couple the adapter layer to a specific provider, making future provider addition expensive.
2. **Embed OpenAI code in AI Engine**: Rejected. AI Engine must remain provider-agnostic by architectural invariant.
3. **External npm package**: Rejected. Official OpenAI SDK is suitable for REST but not the full enterprise WebSocket lifecycle we need (reconnect, heartbeat, circuit breaker, audit).

## Consequences

- Adding future providers (Gemini Live, Azure OpenAI Realtime, etc.) requires only a new module implementing `IRealtimeAiProvider`
- OpenAI-specific protocol updates only affect the `openai-realtime/` module
- No other module requires changes when switching providers
- The platform supports simultaneous multi-provider deployments

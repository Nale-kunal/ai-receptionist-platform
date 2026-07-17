# ADR-0017: Raw Provider Event Types Must Never Cross Module Boundaries

**Status**: Accepted  
**Date**: 2026-07-16

## Context

Provider-specific TypeScript types (e.g., `OpenAiSessionCreatedEvent`, `OpenAiResponseAudioDelta`, `OpenAiConversationItemCreated`) are internal contracts between a provider module and the upstream WebSocket connection. If these types are imported in any module outside `openai-realtime/`, the TypeScript compilation creates a hard coupling to those types.

This coupling is architecturally prohibited by the platform's provider-agnostic invariant.

## Decision

**Raw OpenAI protocol types MUST NOT appear in any import outside `openai-realtime/`.**

Enforcement mechanisms:
1. All OpenAI event types are defined in `openai-realtime.types.ts` and are NOT re-exported from `openai-realtime/index.ts`
2. The `index.ts` barrel ONLY exports `OpenAiRealtimeProvider` (the concrete class)
3. All event routing and normalization is internal to the provider module
4. The `IRealtimeAiProvider` interface methods accept and return only canonical types from `realtime-ai-adapter`
5. The `receiveEvents()` method returns `AsyncIterable<Record<string, unknown>>` — an intentionally opaque type — which is then processed by the event router and normalized before consumers act on it

## Enforcement

- TypeScript module boundaries enforce this at compile time for explicit imports
- Code review: any PR that imports `openai-realtime` types from outside the module is rejected
- Architecture test (future): import analysis CI check to detect cross-boundary type leakage

## Consequences

- The Realtime AI Adapter, Conversation Orchestrator, and all other modules have zero compile-time dependency on any OpenAI type
- A complete provider swap (e.g., from OpenAI to Gemini Live) requires zero changes outside the `openai-realtime/` directory and factory registration
- Provider module changes can never produce TypeScript errors in other modules

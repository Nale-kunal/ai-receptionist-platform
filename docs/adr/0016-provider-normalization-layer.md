# ADR-0016: Provider Normalization Layer Inside Provider Modules

**Status**: Accepted  
**Date**: 2026-07-16

## Context

OpenAI's Realtime API, like any external provider, has its own specific event schema. OpenAI emits events such as `response.audio.delta`, `response.text.done`, `conversation.item.input_audio_transcription.completed`, `response.function_call_arguments.done`, and `input_audio_buffer.speech_stopped`. These are OpenAI-specific and subject to change with each API version.

If these raw event types were to propagate beyond the provider module boundary, all consuming layers (Conversation Orchestrator, AI Engine, etc.) would become coupled to OpenAI's schema. This would make provider replacement or versioning updates expensive and risky.

## Decision

All OpenAI-specific event normalization MUST happen **inside** `openai-realtime/` before any event reaches the `IRealtimeAiProvider` interface boundary. The provider module uses internal handler classes for each event category:

- `OpenAiTranscriptHandler` — normalizes transcript events → `RealtimeTranscriptEvent`
- `OpenAiToolHandler` — normalizes function call events → `RealtimeToolCallEvent`
- `OpenAiInterruptionHandler` — normalizes speech stop events → `RealtimeInterruptionEvent`
- `OpenAiResponseHandler` — normalizes audio delta events → `RealtimeAudioFrame`
- `OpenAiEventRouter` — dispatches raw WebSocket frames to the appropriate handler

The output of these handlers is exclusively the normalized types defined in `realtime-ai-adapter/types/realtime-ai.types.ts`.

## Alternatives Considered

1. **Normalize in Conversation Orchestrator**: Rejected. Orchestrator must not contain provider-specific switch/case logic.
2. **Normalize in Realtime AI Adapter base**: Rejected. Adapter base should not know about any specific provider schema.
3. **Expose raw events and let callers filter**: Rejected. This leaks the provider abstraction.

## Consequences

- Consumers of the Realtime AI Adapter layer see only canonical types regardless of provider
- OpenAI API version upgrades only require updating handler internals within `openai-realtime/`
- All provider modules are required to follow the same normalization-before-boundary rule

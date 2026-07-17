# ADR 0010: Provider-Agnostic Conversation Runtime

## Status
Accepted

## Context
Multiple telephony (Twilio, self-hosted SIP) and LLM (OpenAI, Gemini Live) providers will integrate into the platform. Mixing their specific schemas or protocol payloads within the state coordinator leads to tight coupling.

## Decision
The `ConversationOrchestrator` remains 100% provider-independent. It interacts only with standard interface abstractions (`IRealtimeAiProvider`, `IVoiceProvider`) and utilizes a decoupled domain event model to process transcripts, interruptions, and actions.

## Consequences
- **Pros**: Clear system decoupling, easy integration of new voice or AI providers without modifying the runtime brain.
- **Cons**: Increased mapping complexity inside provider adapters.

## Alternatives Considered
- Writing provider-specific event handlers directly inside the coordinator service. Rejected because it violates the platform manifest decoupling guidelines.

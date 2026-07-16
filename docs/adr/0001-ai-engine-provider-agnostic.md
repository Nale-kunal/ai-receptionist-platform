# ADR 0001: AI Engine Remains Provider-Agnostic

## Status
Accepted

## Context
The platform must support multiple AI providers (OpenAI, Gemini, self-hosted models, etc.) to guarantee high availability, mitigate single-point-of-failure risks, and adapt to future LLM improvements.

## Decision
The core `AiEngine` module shall remain provider-agnostic. It depends strictly on standard adapter interfaces (`IAiProvider`), avoiding any direct imports of provider-specific SDKs (like `@openai/sdk` or `@google/generative-ai`).

## Consequences
- **Pros**: Easy replacement or failover routes between AI providers without modifying core AI orchestration.
- **Cons**: Requires mapping custom adapter structures for each new provider, increasing initial abstraction efforts.

## Alternatives Considered
- Direct integration of OpenAI Realtime API. Rejected because it binds the business core directly to a single vendor.

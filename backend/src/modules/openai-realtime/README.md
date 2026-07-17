# OpenAI Realtime Provider

## Overview

This module implements [`IRealtimeAiProvider`](../realtime-ai-adapter/interfaces/realtime-ai.interfaces.ts) for the [OpenAI Realtime API](https://platform.openai.com/docs/guides/realtime).

It is a **self-contained plugin module** — it has zero knowledge of business domain logic, conversation orchestration, or prompt composition. It only knows how to talk to OpenAI's WebSocket API and produce normalized events.

---

## Architecture Position

```
Conversation Orchestrator
        │
        ▼
 Realtime AI Adapter
 (IRealtimeAiProvider)
        │
        ▼
 OpenAI Realtime Provider   ← This module
        │
        ▼
 OpenAI Realtime API (WSS)
```

---

## Module Structure

```
openai-realtime/
├── openai-realtime.constants.ts        # API endpoints, event types, defaults
├── openai-realtime.types.ts            # Internal OpenAI protocol types (NOT exported)
├── openai-realtime.errors.ts           # Provider-specific errors
├── openai-realtime.interfaces.ts       # Internal component contracts
├── openai-realtime.config.ts           # Configuration loader
├── openai-realtime.validators.ts       # Protocol and payload validators
├── openai-realtime.dto.ts              # Input/output DTOs
├── openai-realtime.websocket.ts        # Enterprise WebSocket manager
├── openai-realtime.session.manager.ts  # Per-session in-memory state
├── openai-realtime.audio.stream.ts     # Bidirectional audio streaming
├── openai-realtime.event.router.ts     # Raw event → normalized event routing
├── openai-realtime.transcript.handler.ts   # Transcript normalization
├── openai-realtime.tool.handler.ts         # Tool call normalization
├── openai-realtime.response.handler.ts     # Audio delta + usage normalization
├── openai-realtime.interruption.handler.ts # Barge-in normalization
├── openai-realtime.metrics.collector.ts    # Operational telemetry
├── openai-realtime.audit.logger.ts         # Structured audit logging
├── openai-realtime.provider.ts         # Main provider class (IRealtimeAiProvider)
├── index.ts                            # Barrel — exports only OpenAiRealtimeProvider
├── tests/                              # Test suites
└── README.md                           # This file
```

---

## Key Design Decisions

### ADR-0015: Plugin Isolation
The provider is registered in `RealtimeAiProviderFactory` and can be replaced without changing any other module.

### ADR-0016: Normalization Before Boundary
All OpenAI events are normalized inside this module before leaving. Consumers only see `RealtimeTranscriptEvent`, `RealtimeToolCallEvent`, `RealtimeInterruptionEvent`, and `RealtimeAudioFrame`.

### ADR-0017: Protocol Types Never Leak
Internal OpenAI types (`OpenAiSessionCreatedEvent`, `OpenAiResponseAudioDelta`, etc.) are NOT exported from `index.ts`. The barrel only exports `OpenAiRealtimeProvider`.

---

## Enterprise Features

| Feature | Implementation |
|---------|---------------|
| **Reconnection** | Exponential backoff (base 1s, max 30s), up to 5 attempts |
| **Heartbeat** | 10-second ping/pong cycle |
| **Idle Timeout** | 60-second idle → graceful disconnect |
| **Circuit Breaker** | CLOSED → OPEN (5 failures) → HALF-OPEN (15s) → CLOSED (2 successes) |
| **Audio Backpressure** | Ring buffer (1000 frames), oldest dropped on overflow |
| **Streaming Accumulation** | Function call argument deltas accumulated before emitting |
| **PHI Redaction** | SSNs, phone numbers, API keys redacted from all audit logs |
| **Metrics** | Session count, token usage, audio throughput, response latency, cost estimate |

---

## Configuration

All configuration is loaded from environment variables with sensible defaults.

| Variable | Default | Description |
|----------|---------|-------------|
| `OPENAI_REALTIME_MODEL` | `gpt-4o-realtime-preview` | Model selection |
| `OPENAI_REALTIME_VOICE` | `alloy` | TTS voice |
| `OPENAI_REALTIME_AUDIO_FORMAT` | `pcm16` | Audio encoding |
| `OPENAI_WS_CONNECT_TIMEOUT_MS` | `10000` | Connection timeout |
| `OPENAI_WS_HEARTBEAT_INTERVAL_MS` | `10000` | Heartbeat interval |
| `OPENAI_WS_IDLE_TIMEOUT_MS` | `60000` | Idle session timeout |
| `OPENAI_WS_MAX_RECONNECT_ATTEMPTS` | `5` | Max reconnect tries |
| `OPENAI_CB_FAILURE_THRESHOLD` | `5` | Circuit breaker failure threshold |
| `OPENAI_CB_HALF_OPEN_TIMEOUT_MS` | `15000` | Circuit breaker reset timeout |
| `OPENAI_TURN_DETECTION_ENABLED` | `true` | Server VAD turn detection |

---

## Usage

```typescript
import { OpenAiRealtimeProvider } from './openai-realtime';

// Provider is registered automatically via RealtimeAiProviderFactory.
// Do NOT instantiate directly in production — use the factory.

const factory = new RealtimeAiProviderFactory();
const provider = factory.getProvider('openai');

await provider.connect(sessionId, apiKey);
await provider.createSession(sessionId, {
  instructions: systemPrompt,
  tools: toolDefinitions,
  voice: 'alloy',
});

// Send audio from telephony
await provider.sendAudio(sessionId, audioFrame);

// Receive normalized events
for await (const event of provider.receiveEvents(sessionId)) {
  // event.type: 'transcript' | 'tool_call' | 'interruption' | 'audio_frame' | 'usage' | 'error'
}
```

---

## Testing

```bash
# Run all provider tests
npx jest backend/src/modules/openai-realtime/tests/

# Run specific suite
npx jest openai-realtime.provider.test
```

All tests use a `MockWebSocket` injected via the `wsFactory` parameter — no real OpenAI connection is made.

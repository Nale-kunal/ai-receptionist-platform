# Voice Server Infrastructure Module

## Purpose

The Voice Server functions as the provider-agnostic, real-time transport layer between telephony systems and the AI Engine. It handles WebSockets, real-time streaming, connection stability, keepalive heartbeats, metrics tracking, and media buffering under backpressure. 

Importantly, it contains **zero business logic**. It only handles audio frames, connections, and session lifecycle routing.

---

## Directory Structure

```text
voice-server/
├── src/
│   ├── config/          # Configurations (timeouts, frame sizes, rate-limits)
│   ├── types/           # Session states, audio frames, metrics formats
│   ├── errors/          # Structured voice server errors
│   ├── events/          # Domain events mapping to lifecycle stages
│   ├── interfaces/      # Provider, media, buffer, and manager contracts
│   ├── sessions/        # VoiceSession model, state machine, and session manager
│   ├── streaming/       # Reusable, codec-neutral audio streaming pipeline
│   ├── audio/           # Circular frame buffer with backpressure signals
│   ├── services/        # Connection manager, metrics collector, audit logger
│   ├── middleware/      # Security validator (flooding, replay, signature validation)
│   ├── index.ts         # Module barrel exports
└── README.md            # Module documentation
```

---

## 1. Provider Abstraction

telephony providers are integrated using the `IVoiceProvider` interface. The module remains strictly decoupled from vendor-specific libraries.

```typescript
export interface IVoiceProvider {
  readonly providerName: string;
  createSession(sessionId: string, metadata: Record<string, unknown>): Promise<void>;
  closeSession(sessionId: string, reason?: string): Promise<void>;
  receiveAudio(sessionId: string): AsyncIterable<AudioFrame>;
  sendAudio(sessionId: string, frame: AudioFrame): Promise<void>;
  receiveEvents(sessionId: string): AsyncIterable<Record<string, unknown>>;
  heartbeat(sessionId: string): Promise<void>;
  connectionStatus(sessionId: string): 'connected' | 'reconnecting' | 'disconnected';
}
```

---

## 2. Session Lifecycle

Session status is tracked by the `VoiceSessionStateMachine` using the following transitions:

```text
CREATED → CONNECTING → CONNECTED → STREAMING ⇄ PAUSED ⇄ RESUMED → DISCONNECTING → ENDED | FAILED
```

Transition rules:
1. `CREATED` may transition to `CONNECTING`, `ENDED`, or `FAILED`.
2. `CONNECTED` may transition to `STREAMING`, `DISCONNECTING`, `ENDED`, or `FAILED`.
3. `ENDED` and `FAILED` are terminal states; no further transitions are permissible.

---

## 3. Media Pipeline & Buffering

- **`MediaPipeline`**: Sequences, normalizes format sizes, and assigns timestamps to inbound/outbound audio frames while tracking dropped sequences.
- **`AudioBuffer`**: Implements a circular buffer of configurable capacity with low/high watermarks. When usage hits `highWatermark` (80%), backpressure flags are raised. When it drops to `lowWatermark` (40%), backpressure is cleared, invoking registered release listeners.

---

## 4. Security Controls

- **Malformed/Oversized Payloads**: Frame sizes are strictly restricted by `maxPayloadSizeBytes` validation.
- **Replay Protection**: The `VoiceSecurityValidator` tracks received audio sequences in a sliding window per session, raising alarms upon receiving duplicate sequences.
- **Rate-Limiting**: Prevents session flooding by validating session creation frequency per tenant.
- **Audit Sanctity**: `VoiceAuditLogger` filters and redacts PHI, credentials, and raw audio payloads.

---

## 5. Extension Guide for Future Providers

To support a new provider (e.g. Twilio Media Streams, OpenAI Realtime, Vapi):

1. **Implement `IVoiceProvider`**: Build a provider adapter class implementing all functions (session lifecycle, send/receive streams).
2. **Handle WebSocket Attachments**: Use the `IVoiceConnectionManager` to link the provider's active WebSocket connection and manage keepalive ping/pongs.
3. **Pipe Audio Frames**: Forward incoming provider buffer arrays to the `MediaPipeline` to get normalized `AudioFrame` structures, enqueue them into `AudioBuffer`, and invoke the AI Engine.

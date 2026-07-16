# Realtime AI Adapter Module

## Purpose

The **Realtime AI Adapter** module isolates provider-specific realtime protocols (such as OpenAI Realtime WebSocket streaming or Google Gemini Live API) from the core Voice Server and AI Engine. 

This ensures that the AI Engine and the Voice Server remain strictly provider-independent and decoupled from vendor-specific payload specifications.

---

## Directory Structure

```text
realtime-ai-adapter/
├── constants/           # Connection states, provider types, and bounds
├── types/               # Audio frames, transcripts, and DTO declarations
├── errors/              # Domain errors (e.g. Session NotFound, Timeout)
├── interfaces/          # Code contracts for managers, providers, and routers
├── events/              # Domain events and pub/sub implementation
├── services/            # Session managers, provider factories, event routers
├── middleware/          # Security validators (size, rate-limits, replay check)
├── validators/          # Zod validation schemas
├── dto/                 # Input/output schemas
├── index.ts             # Barrel exports
└── README.md            # Module documentation
```

---

## 1. Architecture Flow

```text
Telephony Provider (e.g. Twilio)
         ↓
    Voice Server
         ↓
  Realtime AI Adapter  <--- (Provider Abstraction Interface)
         ↓
     AI Engine
         ↓
   Prompt Engine
```

---

## 2. Interface Definition

New realtime providers (e.g., OpenAI Realtime, Gemini Live) must implement the `IRealtimeAiProvider` contract:

```typescript
export interface IRealtimeAiProvider {
  readonly providerName: string;
  connect(sessionId: string, apiKey: string): Promise<void>;
  disconnect(sessionId: string): Promise<void>;
  createSession(sessionId: string, config: Record<string, unknown>): Promise<void>;
  closeSession(sessionId: string): Promise<void>;
  sendAudio(sessionId: string, frame: RealtimeAudioFrame): Promise<void>;
  receiveAudio(sessionId: string): AsyncIterable<RealtimeAudioFrame>;
  sendText(sessionId: string, text: string): Promise<void>;
  receiveEvents(sessionId: string): AsyncIterable<Record<string, unknown>>;
  updateSession(sessionId: string, config: Record<string, unknown>): Promise<void>;
  heartbeat(sessionId: string): Promise<void>;
  connectionStatus(sessionId: string): 'connected' | 'connecting' | 'disconnected';
}
```

---

## 3. Session State Lifecycle

Lifecycle transitions are validated by the `RealtimeSessionStateMachine` according to the following paths:

```text
CREATED → CONNECTING → CONNECTED → STREAMING ⇄ PAUSED → ENDED | FAILED
```

Terminal states (`ENDED`, `FAILED`) prohibit any further state transitions.

---

## 4. Extension Guide

To add a new Realtime AI Provider (e.g., Claude Realtime or Azure OpenAI):

1. **Implement `IRealtimeAiProvider`**: Create a provider adapter class (e.g. `AzureOpenAiRealtimeProvider`) in the adapter module or under `src/providers`.
2. **Handle Handshake & Protocol**: Map the provider's specific WebSocket connection endpoints and format translation. Convert outgoing audio payloads to the provider's schema, and convert incoming text, transcripts, and tool calls into standard adapter types.
3. **Register Provider**: Update the `RealtimeAiProviderFactory` to resolve the new adapter when requested by configuration.

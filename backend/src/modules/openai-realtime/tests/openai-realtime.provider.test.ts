/**
 * OpenAI Realtime Provider — Full Provider Integration Tests
 *
 * Tests the complete OpenAiRealtimeProvider via the IRealtimeAiProvider interface.
 * Uses a MockWebSocket injected via wsFactory — no real OpenAI connection.
 */

import { EventEmitter } from 'events';
import { OpenAiRealtimeProvider } from '../openai-realtime.provider';
import { RealtimeProviderUnavailableError } from '../../realtime-ai-adapter/errors/realtime-ai.errors';
import type { IWebSocket, WebSocketFactory } from '../openai-realtime.websocket';
import type { RealtimeAudioFrame } from '../../realtime-ai-adapter/types/realtime-ai.types';

// ---------------------------------------------------------------------------
// Mock WebSocket
// ---------------------------------------------------------------------------

class ProviderTestWebSocket extends EventEmitter implements IWebSocket {
  public readonly readyState: number = 1;
  public sentMessages: Array<Record<string, unknown>> = [];
  public isClosed = false;

  constructor() {
    super();
    setImmediate(() => this.emit('open'));
  }

  public send(data: string): void {
    this.sentMessages.push(JSON.parse(data));
  }

  public close(): void {
    this.isClosed = true;
    this.emit('close', 1000);
  }

  public simulateEvent(event: Record<string, unknown>): void {
    this.emit('message', Buffer.from(JSON.stringify(event)));
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

function createProviderWithMockWs(): {
  provider: OpenAiRealtimeProvider;
  wsInstances: ProviderTestWebSocket[];
} {
  const wsInstances: ProviderTestWebSocket[] = [];

  const factory: WebSocketFactory = () => {
    const ws = new ProviderTestWebSocket();
    wsInstances.push(ws);
    return ws;
  };

  const provider = new OpenAiRealtimeProvider(
    {
      ws: {
        connectTimeoutMs: 2000,
        heartbeatIntervalMs: 30_000,
        idleTimeoutMs: 30_000,
        maxReconnectAttempts: 0,
      },
    },
    factory,
  );

  return { provider, wsInstances };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('OpenAiRealtimeProvider (integration)', () => {
  // -----------------------------------------------------------------------
  // Provider Identity
  // -----------------------------------------------------------------------

  it('identifies as the openai provider', () => {
    const { provider } = createProviderWithMockWs();
    expect(provider.providerName).toBe('openai');
  });

  // -----------------------------------------------------------------------
  // connect() / disconnect()
  // -----------------------------------------------------------------------

  describe('connect()', () => {
    it('connects and reports connected status', async () => {
      const { provider } = createProviderWithMockWs();
      await provider.connect('sess-p1', 'sk-test');
      expect(provider.connectionStatus('sess-p1')).toBe('connected');
    });

    it('throws RealtimeProviderUnavailableError when apiKey is empty', async () => {
      const { provider } = createProviderWithMockWs();
      await expect(provider.connect('sess-nokey', '')).rejects.toThrow(
        RealtimeProviderUnavailableError,
      );
    });

    it('throws RealtimeProviderUnavailableError when apiKey is whitespace', async () => {
      const { provider } = createProviderWithMockWs();
      await expect(provider.connect('sess-ws', '   ')).rejects.toThrow(
        RealtimeProviderUnavailableError,
      );
    });
  });

  describe('disconnect()', () => {
    it('disconnects and cleans up session state', async () => {
      const { provider, wsInstances } = createProviderWithMockWs();
      await provider.connect('sess-p2', 'sk-test');
      await provider.disconnect('sess-p2');
      expect(provider.connectionStatus('sess-p2')).toBe('disconnected');
      expect(wsInstances[0]!.isClosed).toBe(true);
    });

    it('active session count increments after createSession, decrements on disconnect', async () => {
      const { provider } = createProviderWithMockWs();
      await provider.connect('sess-count-a', 'sk-test');
      await provider.createSession('sess-count-a', {});
      await provider.connect('sess-count-b', 'sk-test');
      await provider.createSession('sess-count-b', {});
      expect(provider.activeSessionCount()).toBe(2);
      await provider.disconnect('sess-count-a');
      expect(provider.activeSessionCount()).toBe(1);
    });
  });

  // -----------------------------------------------------------------------
  // createSession()
  // -----------------------------------------------------------------------

  describe('createSession()', () => {
    it('sends session.update to OpenAI after creation', async () => {
      const { provider, wsInstances } = createProviderWithMockWs();
      await provider.connect('sess-p3', 'sk-test');
      await provider.createSession('sess-p3', {
        model: 'gpt-4o-realtime-preview',
        voice: 'alloy',
        instructions: 'You are a dental receptionist.',
        tools: [],
        temperature: 0.7,
      });

      const ws = wsInstances[0]!;
      const sessionUpdate = ws.sentMessages.find((m) => m['type'] === 'session.update');
      expect(sessionUpdate).toBeDefined();
      expect((sessionUpdate!['session'] as Record<string, unknown>)['voice']).toBe('alloy');
    });

    it('reports active session after creation', async () => {
      const { provider } = createProviderWithMockWs();
      await provider.connect('sess-p4', 'sk-test');
      await provider.createSession('sess-p4', {});
      expect(provider.activeSessionCount()).toBe(1);
    });
  });

  // -----------------------------------------------------------------------
  // sendAudio()
  // -----------------------------------------------------------------------

  describe('sendAudio()', () => {
    it('sends input_audio_buffer.append to OpenAI', async () => {
      const { provider, wsInstances } = createProviderWithMockWs();
      await provider.connect('sess-audio-send', 'sk-test');
      await provider.createSession('sess-audio-send', {});

      const frame: RealtimeAudioFrame = {
        sequence: 0,
        timestamp: Date.now(),
        payload: Buffer.alloc(100, 0x01),
        codec: 'audio/pcm16',
        durationMs: 20,
      };

      await provider.sendAudio('sess-audio-send', frame);

      const ws = wsInstances[0]!;
      const audioMsg = ws.sentMessages.find((m) => m['type'] === 'input_audio_buffer.append');
      expect(audioMsg).toBeDefined();
      expect(typeof audioMsg!['audio']).toBe('string'); // base64
    });
  });

  // -----------------------------------------------------------------------
  // sendText()
  // -----------------------------------------------------------------------

  describe('sendText()', () => {
    it('sends conversation.item.create to OpenAI', async () => {
      const { provider, wsInstances } = createProviderWithMockWs();
      await provider.connect('sess-text', 'sk-test');
      await provider.createSession('sess-text', {});

      await provider.sendText('sess-text', 'I need to book an appointment.');

      const ws = wsInstances[0]!;
      const textMsg = ws.sentMessages.find((m) => m['type'] === 'conversation.item.create');
      expect(textMsg).toBeDefined();
      const item = textMsg!['item'] as Record<string, unknown>;
      expect(item['role']).toBe('user');
      const content = (item['content'] as Array<Record<string, unknown>>)[0]!;
      expect(content['text']).toBe('I need to book an appointment.');
    });
  });

  // -----------------------------------------------------------------------
  // receiveEvents() — normalized event pipeline
  // -----------------------------------------------------------------------

  describe('receiveEvents()', () => {
    it('emits normalized transcript event from OpenAI transcript done', async () => {
      const { provider, wsInstances } = createProviderWithMockWs();
      await provider.connect('sess-events', 'sk-test');
      await provider.createSession('sess-events', {});

      const ws = wsInstances[0]!;
      const events: Array<Record<string, unknown>> = [];

      // Start consuming events
      const gen = provider.receiveEvents('sess-events');

      // Simulate OpenAI sending a transcript event
      ws.simulateEvent({
        type: 'response.audio_transcript.done',
        response_id: 'resp-1',
        item_id: 'item-1',
        output_index: 0,
        content_index: 0,
        transcript: 'Hello, how can I help you?',
      });

      // Disconnect to terminate the generator
      setImmediate(() => void provider.disconnect('sess-events'));

      for await (const event of gen) {
        events.push(event);
      }

      const transcriptEvent = events.find((e) => e['type'] === 'transcript');
      expect(transcriptEvent).toBeDefined();
      const payload = transcriptEvent!['payload'] as Record<string, unknown>;
      expect(payload['text']).toBe('Hello, how can I help you?');
      expect(payload['isFinal']).toBe(true);
      expect(payload['speaker']).toBe('assistant');
    });

    it('emits normalized tool_call event', async () => {
      const { provider, wsInstances } = createProviderWithMockWs();
      await provider.connect('sess-tools', 'sk-test');
      await provider.createSession('sess-tools', {});

      const ws = wsInstances[0]!;
      const events: Array<Record<string, unknown>> = [];

      const gen = provider.receiveEvents('sess-tools');

      ws.simulateEvent({
        type: 'response.function_call_arguments.done',
        response_id: 'resp-2',
        item_id: 'item-2',
        output_index: 0,
        call_id: 'call-abc',
        name: 'book_appointment',
        arguments: '{"date":"2024-01-15","clinicId":"clinic-1"}',
      });

      setImmediate(() => void provider.disconnect('sess-tools'));

      for await (const event of gen) {
        events.push(event);
      }

      const toolEvent = events.find((e) => e['type'] === 'tool_call');
      expect(toolEvent).toBeDefined();
      const payload = toolEvent!['payload'] as Record<string, unknown>;
      const toolCalls = payload['toolCalls'] as Array<Record<string, unknown>>;
      expect(toolCalls[0]!['name']).toBe('book_appointment');
      expect(toolCalls[0]!['id']).toBe('call-abc');
    });

    it('wraps OpenAI error events as normalized error events', async () => {
      const { provider, wsInstances } = createProviderWithMockWs();
      await provider.connect('sess-errors', 'sk-test');
      await provider.createSession('sess-errors', {});

      const ws = wsInstances[0]!;
      const events: Array<Record<string, unknown>> = [];

      const gen = provider.receiveEvents('sess-errors');

      ws.simulateEvent({
        type: 'error',
        error: {
          type: 'invalid_request_error',
          code: 'invalid_model',
          message: 'Model not found.',
        },
      });

      setImmediate(() => void provider.disconnect('sess-errors'));

      for await (const event of gen) {
        events.push(event);
      }

      const errorEvent = events.find((e) => e['type'] === 'error');
      expect(errorEvent).toBeDefined();
    });
  });

  // -----------------------------------------------------------------------
  // heartbeat()
  // -----------------------------------------------------------------------

  describe('heartbeat()', () => {
    it('sends a ping over the WebSocket', async () => {
      const { provider, wsInstances } = createProviderWithMockWs();
      await provider.connect('sess-hb', 'sk-test');
      await provider.heartbeat('sess-hb');

      const ws = wsInstances[0]!;
      const ping = ws.sentMessages.find((m) => m['type'] === 'ping');
      expect(ping).toBeDefined();
    });
  });

  // -----------------------------------------------------------------------
  // closeSession()
  // -----------------------------------------------------------------------

  describe('closeSession()', () => {
    it('closes the session and reports disconnected', async () => {
      const { provider } = createProviderWithMockWs();
      await provider.connect('sess-close', 'sk-test');
      await provider.createSession('sess-close', {});
      await provider.closeSession('sess-close');
      expect(provider.connectionStatus('sess-close')).toBe('disconnected');
    });
  });

  // -----------------------------------------------------------------------
  // getMetrics()
  // -----------------------------------------------------------------------

  describe('getMetrics()', () => {
    it('returns a valid RealtimeMetrics snapshot', () => {
      const { provider } = createProviderWithMockWs();
      const metrics = provider.getMetrics();
      expect(metrics).toHaveProperty('concurrentSessions');
      expect(metrics).toHaveProperty('totalTokensUsed');
      expect(metrics).toHaveProperty('averageResponseTimeMs');
      expect(metrics).toHaveProperty('reconnectAttemptsCount');
      expect(metrics).toHaveProperty('failedConnectionsCount');
    });

    it('tracks concurrent session count', async () => {
      const { provider } = createProviderWithMockWs();
      await provider.connect('sess-m1', 'sk-test');
      await provider.createSession('sess-m1', {});
      await provider.connect('sess-m2', 'sk-test');
      await provider.createSession('sess-m2', {});

      const metrics = provider.getMetrics();
      expect(metrics.concurrentSessions).toBe(2);
    });
  });

  // -----------------------------------------------------------------------
  // connectionStatus()
  // -----------------------------------------------------------------------

  describe('connectionStatus()', () => {
    it('returns disconnected for unknown sessions', () => {
      const { provider } = createProviderWithMockWs();
      expect(provider.connectionStatus('unknown')).toBe('disconnected');
    });

    it('returns connected for active sessions', async () => {
      const { provider } = createProviderWithMockWs();
      await provider.connect('sess-status', 'sk-test');
      expect(provider.connectionStatus('sess-status')).toBe('connected');
    });
  });
});

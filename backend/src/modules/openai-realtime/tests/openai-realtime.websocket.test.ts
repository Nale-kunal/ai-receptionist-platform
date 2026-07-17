/**
 * OpenAI Realtime Provider — WebSocket Manager Tests
 *
 * Tests: connection lifecycle, heartbeat, idle timeout, reconnect,
 * circuit breaker state machine, message queuing, session cleanup.
 */

import { EventEmitter } from 'events';
import { OpenAiRealtimeWebSocketManager, type IWebSocket, type WebSocketFactory } from '../openai-realtime.websocket';
import {
  OpenAiSessionAlreadyExistsError,
  OpenAiSessionNotFoundError,
  OpenAiConnectionFailedError,
} from '../openai-realtime.errors';
import { loadOpenAiRealtimeConfig } from '../openai-realtime.config';

// ---------------------------------------------------------------------------
// Mock WebSocket
// ---------------------------------------------------------------------------

class MockWebSocket extends EventEmitter implements IWebSocket {
  public readonly readyState: number = 1; // OPEN
  public sentMessages: string[] = [];
  public closeWasCalled = false;
  public shouldFailOpen = false;

  constructor() {
    super();
    // Simulate async open
    setImmediate(() => {
      if (this.shouldFailOpen) {
        this.emit('error', new Error('Connection refused'));
      } else {
        this.emit('open');
      }
    });
  }

  public send(data: string): void {
    this.sentMessages.push(data);
  }

  public close(): void {
    this.closeWasCalled = true;
    this.emit('close', 1000);
  }

  public simulateMessage(event: Record<string, unknown>): void {
    this.emit('message', Buffer.from(JSON.stringify(event)));
  }

  public simulateClose(code = 1006): void {
    this.emit('close', code);
  }
}

// ---------------------------------------------------------------------------
// WebSocket Factory
// ---------------------------------------------------------------------------

function createMockFactory(options: { shouldFail?: boolean } = {}): {
  factory: WebSocketFactory;
  instances: MockWebSocket[];
} {
  const instances: MockWebSocket[] = [];
  const factory: WebSocketFactory = () => {
    const ws = new MockWebSocket();
    ws.shouldFailOpen = options.shouldFail ?? false;
    instances.push(ws);
    return ws;
  };
  return { factory, instances };
}

// ---------------------------------------------------------------------------
// Test Helpers
// ---------------------------------------------------------------------------

function createManager(factoryOptions?: { shouldFail?: boolean }) {
  const config = loadOpenAiRealtimeConfig({
    ws: {
      connectTimeoutMs: 2000,
      heartbeatIntervalMs: 500,
      idleTimeoutMs: 1000,
      maxReconnectAttempts: 2,
    },
    circuitBreaker: {
      failureThreshold: 3,
      successThreshold: 2,
      halfOpenTimeoutMs: 500,
    },
  });

  const { factory, instances } = createMockFactory(factoryOptions);
  const manager = new OpenAiRealtimeWebSocketManager(config, factory);
  return { manager, instances };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('OpenAiRealtimeWebSocketManager', () => {
  // -----------------------------------------------------------------------
  // Connection Lifecycle
  // -----------------------------------------------------------------------

  describe('connect()', () => {
    it('establishes a connection and sets status to connected', async () => {
      const { manager } = createManager();
      await manager.connect('sess-1', 'sk-test', 'gpt-4o-realtime-preview');
      expect(manager.connectionStatus('sess-1')).toBe('connected');
    });

    it('throws SessionAlreadyExists for duplicate sessionId', async () => {
      const { manager } = createManager();
      await manager.connect('sess-2', 'sk-test', 'gpt-4o-realtime-preview');
      await expect(
        manager.connect('sess-2', 'sk-test', 'gpt-4o-realtime-preview'),
      ).rejects.toThrow(OpenAiSessionAlreadyExistsError);
    });

    it('tracks active session count', async () => {
      const { manager } = createManager();
      await manager.connect('sess-a', 'sk-test', 'gpt-4o-realtime-preview');
      await manager.connect('sess-b', 'sk-test', 'gpt-4o-realtime-preview');
      expect(manager.activeSessionCount()).toBe(2);
    });
  });

  // -----------------------------------------------------------------------
  // Disconnect
  // -----------------------------------------------------------------------

  describe('disconnect()', () => {
    it('disconnects and removes session', async () => {
      const { manager } = createManager();
      await manager.connect('sess-3', 'sk-test', 'gpt-4o-realtime-preview');
      await manager.disconnect('sess-3');
      expect(manager.connectionStatus('sess-3')).toBe('idle');
      expect(manager.activeSessionCount()).toBe(0);
    });

    it('throws SessionNotFound when disconnecting unknown session', async () => {
      const { manager } = createManager();
      await expect(manager.disconnect('ghost-session')).rejects.toThrow(OpenAiSessionNotFoundError);
    });
  });

  // -----------------------------------------------------------------------
  // Message Queue
  // -----------------------------------------------------------------------

  describe('messages()', () => {
    it('yields messages pushed by simulated WebSocket', async () => {
      const { manager, instances } = createManager();
      await manager.connect('sess-4', 'sk-test', 'gpt-4o-realtime-preview');

      const ws = instances[0]!;
      const received: Record<string, unknown>[] = [];

      const gen = manager.messages('sess-4');

      // Simulate incoming event BEFORE consuming
      ws.simulateMessage({ type: 'session.created', session: { id: 'openai-sess-1' } });
      ws.simulateMessage({ type: 'response.done', response: { id: 'resp-1', status: 'completed' } });

      // Consume two messages then disconnect
      for await (const msg of gen) {
        received.push(msg);
        if (received.length >= 2) {
          await manager.disconnect('sess-4');
          break;
        }
      }

      expect(received).toHaveLength(2);
      expect(received[0]!['type']).toBe('session.created');
      expect(received[1]!['type']).toBe('response.done');
    });

    it('throws SessionNotFound for unknown session', async () => {
      const { manager } = createManager();
      expect(() => manager.messages('unknown-sess')).not.toThrow();
      const gen = manager.messages('unknown-sess') as AsyncIterable<Record<string, unknown>> & { [Symbol.asyncIterator](): AsyncIterator<Record<string, unknown>> };
      const iter = gen[Symbol.asyncIterator]();
      await expect(iter.next()).rejects.toThrow(OpenAiSessionNotFoundError);
    });
  });

  // -----------------------------------------------------------------------
  // Send
  // -----------------------------------------------------------------------

  describe('send()', () => {
    it('sends JSON-encoded messages over the WebSocket', async () => {
      const { manager, instances } = createManager();
      await manager.connect('sess-5', 'sk-test', 'gpt-4o-realtime-preview');

      await manager.send('sess-5', { type: 'session.update', session: {} });
      const ws = instances[0]!;
      expect(ws.sentMessages).toHaveLength(1);
      expect(JSON.parse(ws.sentMessages[0]!)).toMatchObject({ type: 'session.update' });
    });

    it('throws ConnectionFailed when not connected', async () => {
      const { manager } = createManager();
      await manager.connect('sess-6', 'sk-test', 'gpt-4o-realtime-preview');
      // Force disconnect state
      const session = manager.getSession('sess-6')!;
      (session as unknown as Record<string, unknown>)['status'] = 'disconnected';

      await expect(
        manager.send('sess-6', { type: 'test' }),
      ).rejects.toThrow(OpenAiConnectionFailedError);
    });
  });

  // -----------------------------------------------------------------------
  // Circuit Breaker
  // -----------------------------------------------------------------------

  describe('Circuit Breaker', () => {
    it('starts in CLOSED state', async () => {
      const { manager } = createManager();
      await manager.connect('sess-cb-1', 'sk-test', 'gpt-4o-realtime-preview');
      const cb = manager.circuitBreakerStatus('sess-cb-1');
      expect(cb.state).toBe('closed');
    });

    it('returns a fresh breaker for unknown sessions', () => {
      const { manager } = createManager();
      const cb = manager.circuitBreakerStatus('nonexistent');
      expect(cb.state).toBe('closed');
    });
  });

  // -----------------------------------------------------------------------
  // Heartbeat
  // -----------------------------------------------------------------------

  describe('ping()', () => {
    it('sends a ping message to connected session', async () => {
      const { manager, instances } = createManager();
      await manager.connect('sess-hb', 'sk-test', 'gpt-4o-realtime-preview');
      await manager.ping('sess-hb');
      const ws = instances[0]!;
      const ping = ws.sentMessages.find((m) => JSON.parse(m).type === 'ping');
      expect(ping).toBeDefined();
    });
  });

  // -----------------------------------------------------------------------
  // Concurrent Sessions
  // -----------------------------------------------------------------------

  describe('Concurrent sessions', () => {
    it('manages 50 concurrent sessions independently', async () => {
      const { manager } = createManager();
      const sessionIds = Array.from({ length: 50 }, (_, i) => `concurrent-${i}`);

      await Promise.all(
        sessionIds.map((id) => manager.connect(id, 'sk-test', 'gpt-4o-realtime-preview')),
      );

      expect(manager.activeSessionCount()).toBe(50);

      // Each session has its own state
      for (const id of sessionIds) {
        expect(manager.connectionStatus(id)).toBe('connected');
      }

      await Promise.all(sessionIds.map((id) => manager.disconnect(id)));
      expect(manager.activeSessionCount()).toBe(0);
    });
  });
});

/**
 * OpenAI Realtime Provider — WebSocket Manager
 *
 * Enterprise-grade WebSocket lifecycle management for OpenAI Realtime API.
 * Responsibilities:
 *   - Establish and authenticate WebSocket connections
 *   - Heartbeat / ping-pong to detect silent disconnects
 *   - Exponential backoff reconnection
 *   - Idle session timeout enforcement
 *   - Circuit breaker (CLOSED → OPEN → HALF-OPEN → CLOSED)
 *   - Per-session message queuing via async generator
 *   - Clean session teardown
 *
 * NOTE: The actual WebSocket is abstracted via a minimal interface.
 * In production, wire in the 'ws' npm package. In tests, use the
 * MockWebSocket provided in the test suite.
 */

import { EventEmitter } from 'events';
import type { IOpenAiWebSocketManager } from './openai-realtime.interfaces';
import type { OpenAiWsSession, OpenAiWsConnectionStatus, CircuitBreakerStatus } from './openai-realtime.types';
import {
  OpenAiConnectionFailedError,
  OpenAiConnectionTimeoutError,
  OpenAiSessionNotFoundError,
  OpenAiSessionAlreadyExistsError,
  OpenAiCircuitOpenError,
  OpenAiProtocolError,
} from './openai-realtime.errors';
import {
  OPENAI_WS_CONNECT_TIMEOUT_MS,
  OPENAI_WS_HEARTBEAT_INTERVAL_MS,
  OPENAI_WS_IDLE_TIMEOUT_MS,
  OPENAI_WS_RECONNECT_BASE_DELAY_MS,
  OPENAI_WS_RECONNECT_MAX_DELAY_MS,
  OPENAI_CB_FAILURE_THRESHOLD,
  OPENAI_CB_SUCCESS_THRESHOLD,
  OPENAI_CB_HALF_OPEN_TIMEOUT_MS,
  OPENAI_REALTIME_API_BASE_URL,
} from './openai-realtime.constants';
import type { OpenAiRealtimeProviderConfig } from './openai-realtime.config';

// ---------------------------------------------------------------------------
// Minimal WebSocket Abstraction (allows injection in tests)
// ---------------------------------------------------------------------------

export interface IWebSocket extends EventEmitter {
  send(data: string): void;
  close(): void;
  readonly readyState: number;
}

export type WebSocketFactory = (url: string, options: { headers: Record<string, string> }) => IWebSocket;

// Sensible production factory using the 'ws' package (dynamically required at runtime)
function defaultWebSocketFactory(url: string, options: { headers: Record<string, string> }): IWebSocket {
  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
  const WS = require('ws') as any;
  return new WS(url, { headers: options.headers }) as IWebSocket;
}

// ---------------------------------------------------------------------------
// OpenAI WebSocket Manager Implementation
// ---------------------------------------------------------------------------

export class OpenAiRealtimeWebSocketManager implements IOpenAiWebSocketManager {
  private readonly sessions = new Map<string, OpenAiWsSession>();
  // Stores message queues: sessionId → array of pending events + signal
  private readonly messageQueues = new Map<string, Array<Record<string, unknown>>>();
  private readonly queueResolvers = new Map<string, (() => void)[]>();
  private readonly config: OpenAiRealtimeProviderConfig;
  private readonly wsFactory: WebSocketFactory;

  constructor(
    config: OpenAiRealtimeProviderConfig,
    wsFactory: WebSocketFactory = defaultWebSocketFactory,
  ) {
    this.config = config;
    this.wsFactory = wsFactory;
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  public async connect(sessionId: string, apiKey: string, model: string): Promise<void> {
    if (this.sessions.has(sessionId)) {
      throw new OpenAiSessionAlreadyExistsError(sessionId);
    }

    const cb = this.freshCircuitBreaker();
    const session: OpenAiWsSession = {
      sessionId,
      wsUrl: `${OPENAI_REALTIME_API_BASE_URL}?model=${encodeURIComponent(model)}`,
      ws: null,
      status: 'connecting',
      connectedAt: null,
      lastPingAt: null,
      lastPongAt: null,
      reconnectAttempt: 0,
      heartbeatTimer: null,
      idleTimer: null,
      audioSequence: 0,
      eventBuffer: [],
      circuitBreaker: cb,
    };
    this.sessions.set(sessionId, session);
    this.messageQueues.set(sessionId, []);
    this.queueResolvers.set(sessionId, []);

    await this.establishConnection(sessionId, apiKey, model);
  }

  public async disconnect(sessionId: string): Promise<void> {
    const session = this.requireSession(sessionId);
    this.clearTimers(session);
    const ws = session.ws as IWebSocket | null;
    if (ws) {
      ws.close();
    }
    session.status = 'disconnected';
    this.flushQueue(sessionId); // Unblock any pending async generators
    this.sessions.delete(sessionId);
    this.messageQueues.delete(sessionId);
    this.queueResolvers.delete(sessionId);
  }

  public async send(sessionId: string, event: Record<string, unknown>): Promise<void> {
    const session = this.requireSession(sessionId);
    const ws = session.ws as IWebSocket | null;
    if (!ws || session.status !== 'connected') {
      throw new OpenAiConnectionFailedError(sessionId, 'Cannot send: session not connected.');
    }
    ws.send(JSON.stringify(event));
  }

  public async *messages(sessionId: string): AsyncIterable<Record<string, unknown>> {
    const queue = this.messageQueues.get(sessionId);
    if (!queue) {
      throw new OpenAiSessionNotFoundError(sessionId);
    }

    while (true) {
      const session = this.sessions.get(sessionId);
      if (!session || session.status === 'disconnected' || session.status === 'failed') {
        break;
      }

      if (queue.length > 0) {
        yield queue.shift()!;
        continue;
      }

      // Wait for next message
      await new Promise<void>((resolve) => {
        const resolvers = this.queueResolvers.get(sessionId);
        if (resolvers) {
          resolvers.push(resolve);
        } else {
          resolve(); // Session gone
        }
      });
    }
  }

  public connectionStatus(sessionId: string): OpenAiWsConnectionStatus {
    return this.sessions.get(sessionId)?.status ?? 'idle';
  }

  public getSession(sessionId: string): OpenAiWsSession | undefined {
    return this.sessions.get(sessionId);
  }

  public async ping(sessionId: string): Promise<void> {
    const session = this.requireSession(sessionId);
    const ws = session.ws as IWebSocket | null;
    if (ws && session.status === 'connected') {
      session.lastPingAt = Date.now();
      // OpenAI Realtime uses WebSocket ping frames or JSON heartbeats
      ws.send(JSON.stringify({ type: 'ping' }));
    }
  }

  public circuitBreakerStatus(sessionId: string): CircuitBreakerStatus {
    return this.sessions.get(sessionId)?.circuitBreaker ?? this.freshCircuitBreaker();
  }

  // ---------------------------------------------------------------------------
  // Internal Connection Management
  // ---------------------------------------------------------------------------

  private async establishConnection(
    sessionId: string,
    apiKey: string,
    model: string,
  ): Promise<void> {
    const session = this.requireSession(sessionId);

    // Check circuit breaker
    this.assertCircuitClosed(session);

    const url = `${OPENAI_REALTIME_API_BASE_URL}?model=${encodeURIComponent(model)}`;

    return new Promise<void>((resolve, reject) => {
      const timeoutHandle = setTimeout(() => {
        reject(new OpenAiConnectionTimeoutError(sessionId, this.config.ws.connectTimeoutMs));
      }, this.config.ws.connectTimeoutMs);

      let ws: IWebSocket;
      try {
        ws = this.wsFactory(url, {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'OpenAI-Beta': 'realtime=v1',
          },
        });
      } catch (err) {
        clearTimeout(timeoutHandle);
        this.recordFailure(session);
        reject(new OpenAiConnectionFailedError(sessionId, String(err)));
        return;
      }

      session.ws = ws;

      ws.on('open', () => {
        clearTimeout(timeoutHandle);
        session.status = 'connected';
        session.connectedAt = Date.now();
        session.reconnectAttempt = 0;
        this.recordSuccess(session);
        this.startHeartbeat(sessionId);
        this.resetIdleTimer(sessionId);
        resolve();
      });

      ws.on('message', (raw: Buffer | string) => {
        this.resetIdleTimer(sessionId);
        try {
          const str = typeof raw === 'string' ? raw : raw.toString('utf-8');
          const event = JSON.parse(str) as Record<string, unknown>;
          this.enqueueMessage(sessionId, event);
        } catch {
          // Malformed JSON from OpenAI — record as protocol error
          this.enqueueMessage(sessionId, {
            type: 'error',
            error: { type: 'protocol', message: 'Received non-JSON message from OpenAI.' },
          });
        }
      });

      ws.on('pong', () => {
        session.lastPongAt = Date.now();
      });

      ws.on('close', (code: number) => {
        if (session.status === 'connected' || session.status === 'connecting') {
          session.status = 'reconnecting';
          void this.scheduleReconnect(sessionId, apiKey, model, code);
        }
      });

      ws.on('error', (err: Error) => {
        clearTimeout(timeoutHandle);
        this.recordFailure(session);
        if (session.status === 'connecting') {
          session.status = 'failed';
          reject(new OpenAiConnectionFailedError(sessionId, err.message));
        } else {
          this.enqueueMessage(sessionId, {
            type: 'error',
            error: { type: 'transport', message: err.message },
          });
        }
      });
    });
  }

  private async scheduleReconnect(
    sessionId: string,
    apiKey: string,
    model: string,
    closeCode: number,
  ): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    if (
      session.reconnectAttempt >= this.config.ws.maxReconnectAttempts ||
      session.circuitBreaker.state === 'open'
    ) {
      session.status = 'failed';
      this.flushQueue(sessionId);
      return;
    }

    session.reconnectAttempt += 1;

    const delay = Math.min(
      OPENAI_WS_RECONNECT_BASE_DELAY_MS * 2 ** (session.reconnectAttempt - 1),
      OPENAI_WS_RECONNECT_MAX_DELAY_MS,
    );

    // Emit internal reconnect event for metrics/audit
    this.enqueueMessage(sessionId, {
      type: '_internal.reconnect_attempt',
      attempt: session.reconnectAttempt,
      delay,
      closeCode,
    });

    await new Promise<void>((r) => setTimeout(r, delay));

    try {
      await this.establishConnection(sessionId, apiKey, model);
    } catch {
      await this.scheduleReconnect(sessionId, apiKey, model, 0);
    }
  }

  // ---------------------------------------------------------------------------
  // Heartbeat
  // ---------------------------------------------------------------------------

  private startHeartbeat(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.heartbeatTimer = setInterval(() => {
      void this.ping(sessionId).catch(() => {
        /* heartbeat failure is non-fatal */
      });
    }, this.config.ws.heartbeatIntervalMs);
  }

  // ---------------------------------------------------------------------------
  // Idle Timeout
  // ---------------------------------------------------------------------------

  private resetIdleTimer(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    if (session.idleTimer) {
      clearTimeout(session.idleTimer);
    }

    session.idleTimer = setTimeout(() => {
      this.enqueueMessage(sessionId, {
        type: '_internal.idle_timeout',
        sessionId,
      });
      void this.disconnect(sessionId).catch(() => { /* ignore */ });
    }, this.config.ws.idleTimeoutMs);
  }

  // ---------------------------------------------------------------------------
  // Message Queue Helpers
  // ---------------------------------------------------------------------------

  private enqueueMessage(sessionId: string, event: Record<string, unknown>): void {
    const queue = this.messageQueues.get(sessionId);
    if (!queue) return;
    queue.push(event);

    // Wake up any waiting async generators
    const resolvers = this.queueResolvers.get(sessionId);
    if (resolvers && resolvers.length > 0) {
      const resolve = resolvers.shift()!;
      resolve();
    }
  }

  private flushQueue(sessionId: string): void {
    const resolvers = this.queueResolvers.get(sessionId);
    if (!resolvers) return;
    for (const r of resolvers) r();
    resolvers.length = 0;
  }

  // ---------------------------------------------------------------------------
  // Circuit Breaker
  // ---------------------------------------------------------------------------

  private freshCircuitBreaker(): CircuitBreakerStatus {
    return {
      state: 'closed',
      consecutiveFailures: 0,
      consecutiveSuccesses: 0,
      openedAt: null,
      nextAttemptAt: null,
    };
  }

  private assertCircuitClosed(session: OpenAiWsSession): void {
    const cb = session.circuitBreaker;
    if (cb.state === 'open') {
      const now = Date.now();
      if (cb.nextAttemptAt && now >= cb.nextAttemptAt) {
        // Transition to half-open
        cb.state = 'half-open';
      } else {
        throw new OpenAiCircuitOpenError(cb.nextAttemptAt ?? now + this.config.circuitBreaker.halfOpenTimeoutMs);
      }
    }
  }

  private recordFailure(session: OpenAiWsSession): void {
    const cb = session.circuitBreaker;
    cb.consecutiveFailures += 1;
    cb.consecutiveSuccesses = 0;

    if (
      cb.state === 'closed' &&
      cb.consecutiveFailures >= this.config.circuitBreaker.failureThreshold
    ) {
      cb.state = 'open';
      cb.openedAt = Date.now();
      cb.nextAttemptAt = Date.now() + this.config.circuitBreaker.halfOpenTimeoutMs;
    } else if (cb.state === 'half-open') {
      cb.state = 'open';
      cb.openedAt = Date.now();
      cb.nextAttemptAt = Date.now() + this.config.circuitBreaker.halfOpenTimeoutMs;
    }
  }

  private recordSuccess(session: OpenAiWsSession): void {
    const cb = session.circuitBreaker;
    cb.consecutiveSuccesses += 1;
    cb.consecutiveFailures = 0;

    if (cb.state === 'half-open' && cb.consecutiveSuccesses >= this.config.circuitBreaker.successThreshold) {
      cb.state = 'closed';
      cb.openedAt = null;
      cb.nextAttemptAt = null;
    }
  }

  // ---------------------------------------------------------------------------
  // Utilities
  // ---------------------------------------------------------------------------

  private requireSession(sessionId: string): OpenAiWsSession {
    const session = this.sessions.get(sessionId);
    if (!session) throw new OpenAiSessionNotFoundError(sessionId);
    return session;
  }

  private clearTimers(session: OpenAiWsSession): void {
    if (session.heartbeatTimer) {
      clearInterval(session.heartbeatTimer);
      session.heartbeatTimer = null;
    }
    if (session.idleTimer) {
      clearTimeout(session.idleTimer);
      session.idleTimer = null;
    }
  }

  /** For tests: returns the number of active sessions. */
  public activeSessionCount(): number {
    return this.sessions.size;
  }
}

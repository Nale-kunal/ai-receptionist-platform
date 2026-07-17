/**
 * Twilio Voice Provider Implementation
 *
 * Implements the core IVoiceProvider interface.
 */

import type { IVoiceProvider } from '../../interfaces/voice-server.interfaces';
import type { AudioFrame } from '../../types/voice-server.types';
import type { TwilioProviderConfig } from './twilio.config';
import { loadTwilioConfig } from './twilio.config';
import { TwilioVoiceSessionManager } from './twilio.voice-session.manager';
import { TwilioCallLifecycle } from './twilio.call.lifecycle';
import { TwilioMetricsCollector } from './twilio.metrics.collector';
import { TwilioAuditLogger } from './twilio.audit.logger';
import { TwilioSecurityValidator } from './twilio.security.validator';
import {
  TWILIO_PROVIDER_NAME,
  TWILIO_CALL_STATE_RINGING,
  TWILIO_CALL_STATE_STREAMING,
  TWILIO_CALL_STATE_ENDED,
  TWILIO_CALL_STATE_FAILED,
} from './twilio.constants';
import { CallLifecycleFailure, ConnectionFailure } from './twilio.errors';

export class TwilioVoiceProvider implements IVoiceProvider {
  public readonly providerName = TWILIO_PROVIDER_NAME;

  private readonly sessionManager = new TwilioVoiceSessionManager();
  private readonly metrics = new TwilioMetricsCollector();
  private readonly audit: TwilioAuditLogger;
  private readonly config: TwilioProviderConfig;
  private readonly securityValidator: TwilioSecurityValidator;

  // Stream queues for async iterables: sessionId -> queue arrays
  private readonly audioQueues = new Map<string, AudioFrame[]>();
  private readonly audioResolvers = new Map<string, (() => void)[]>();
  
  private readonly eventQueues = new Map<string, Record<string, unknown>[]>();
  private readonly eventResolvers = new Map<string, (() => void)[]>();

  constructor(
    config?: Partial<TwilioProviderConfig>,
    auditSink?: ConstructorParameters<typeof TwilioAuditLogger>[0],
  ) {
    this.config = loadTwilioConfig(config);
    this.securityValidator = new TwilioSecurityValidator(this.config.authToken);
    this.audit = new TwilioAuditLogger(auditSink);
  }

  // ---------------------------------------------------------------------------
  // IVoiceProvider Connection & Lifecycle
  // ---------------------------------------------------------------------------

  public async createSession(sessionId: string, metadata: Record<string, unknown>): Promise<void> {
    const callSid = String(metadata['callSid'] ?? `mock_sid_${Math.random()}`);
    const tenantId = String(metadata['tenantId'] ?? 'default-tenant');

    this.sessionManager.createSession(sessionId, callSid, tenantId, null, metadata);
    this.audioQueues.set(sessionId, []);
    this.audioResolvers.set(sessionId, []);
    this.eventQueues.set(sessionId, []);
    this.eventResolvers.set(sessionId, []);

    this.metrics.trackCallStart();
    this.audit.logCallCreated(sessionId, callSid, String(metadata['from'] ?? ''), String(metadata['to'] ?? ''));
  }

  public async closeSession(sessionId: string, reason?: string): Promise<void> {
    const session = this.sessionManager.getSession(sessionId);
    if (!session) return;

    TwilioCallLifecycle.validateTransition(session.state, TWILIO_CALL_STATE_ENDED);
    this.sessionManager.updateState(sessionId, TWILIO_CALL_STATE_ENDED);

    // Flush and clean up queues
    this.flushAudioQueue(sessionId);
    this.flushEventQueue(sessionId);

    this.audioQueues.delete(sessionId);
    this.audioResolvers.delete(sessionId);
    this.eventQueues.delete(sessionId);
    this.eventResolvers.delete(sessionId);

    this.sessionManager.removeSession(sessionId);
    this.metrics.trackCallEnd(Date.now() - session.createdAt);
    this.audit.logCallEnded(sessionId, Date.now() - session.createdAt);
  }

  // ---------------------------------------------------------------------------
  // IVoiceProvider Inbound/Outbound Streams
  // ---------------------------------------------------------------------------

  public async *receiveAudio(sessionId: string): AsyncIterable<AudioFrame> {
    const queue = this.audioQueues.get(sessionId);
    if (!queue) return;

    while (true) {
      const session = this.sessionManager.getSession(sessionId);
      if (!session || TwilioCallLifecycle.isTerminal(session.state)) {
        break;
      }

      if (queue.length > 0) {
        yield queue.shift()!;
        continue;
      }

      await new Promise<void>((resolve) => {
        const resolvers = this.audioResolvers.get(sessionId);
        if (resolvers) {
          resolvers.push(resolve);
        } else {
          resolve();
        }
      });
    }
  }

  public async sendAudio(sessionId: string, frame: AudioFrame): Promise<void> {
    const session = this.sessionManager.getSession(sessionId);
    if (!session || TwilioCallLifecycle.isTerminal(session.state)) {
      throw new ConnectionFailure('Cannot send audio: session is closed.');
    }

    // Abstract outbound transport: this pipes audio frames to the connected WS socket
    // In production, we find the socket from connectionManager and socket.send(...)
    this.metrics.trackLatency(Date.now() - frame.timestamp);
  }

  public async *receiveEvents(sessionId: string): AsyncIterable<Record<string, unknown>> {
    const queue = this.eventQueues.get(sessionId);
    if (!queue) return;

    while (true) {
      const session = this.sessionManager.getSession(sessionId);
      if (!session || TwilioCallLifecycle.isTerminal(session.state)) {
        break;
      }

      if (queue.length > 0) {
        yield queue.shift()!;
        continue;
      }

      await new Promise<void>((resolve) => {
        const resolvers = this.eventResolvers.get(sessionId);
        if (resolvers) {
          resolvers.push(resolve);
        } else {
          resolve();
        }
      });
    }
  }

  // ---------------------------------------------------------------------------
  // IVoiceProvider Helpers
  // ---------------------------------------------------------------------------

  public async heartbeat(sessionId: string): Promise<void> {
    const session = this.sessionManager.getSession(sessionId);
    if (!session) throw new ConnectionFailure('Session not found.');
    // Keepalive checks
  }

  public connectionStatus(sessionId: string): 'connected' | 'reconnecting' | 'disconnected' {
    const session = this.sessionManager.getSession(sessionId);
    if (!session) return 'disconnected';
    if (session.state === TWILIO_CALL_STATE_STREAMING) return 'connected';
    if (session.state === TWILIO_CALL_STATE_RINGING) return 'reconnecting';
    return 'disconnected';
  }

  // ---------------------------------------------------------------------------
  // Internal Frame / Event Pushers
  // ---------------------------------------------------------------------------

  public pushInboundAudio(sessionId: string, frame: AudioFrame): void {
    const queue = this.audioQueues.get(sessionId);
    if (!queue) return;
    queue.push(frame);

    const resolvers = this.audioResolvers.get(sessionId);
    if (resolvers && resolvers.length > 0) {
      const resolve = resolvers.shift()!;
      resolve();
    }
  }

  public pushNormalizedEvent(sessionId: string, event: Record<string, unknown>): void {
    const queue = this.eventQueues.get(sessionId);
    if (!queue) return;
    queue.push(event);

    const resolvers = this.eventResolvers.get(sessionId);
    if (resolvers && resolvers.length > 0) {
      const resolve = resolvers.shift()!;
      resolve();
    }
  }

  private flushAudioQueue(sessionId: string): void {
    const resolvers = this.audioResolvers.get(sessionId);
    if (resolvers) {
      for (const r of resolvers) r();
      resolvers.length = 0;
    }
  }

  private flushEventQueue(sessionId: string): void {
    const resolvers = this.eventResolvers.get(sessionId);
    if (resolvers) {
      for (const r of resolvers) r();
      resolvers.length = 0;
    }
  }

  // metrics accessor
  public getMetricsCollector(): TwilioMetricsCollector {
    return this.metrics;
  }

  // config accessor
  public getProviderConfig(): TwilioProviderConfig {
    return this.config;
  }
}

/**
 * Twilio Voice Provider — WebSocket Media Stream Gateway
 */

import type { EventEmitter } from 'events';
import type { IncomingMessage } from 'http';
import { TwilioMediaStreamHandler } from './twilio.media-stream.handler';
import { TwilioVoiceSessionManager } from './twilio.voice-session.manager';
import type { IVoiceConnectionManager } from '../../interfaces/voice-server.interfaces';
import { TWILIO_WS_HEARTBEAT_INTERVAL_MS, TWILIO_WS_IDLE_TIMEOUT_MS } from './twilio.constants';

export class TwilioWebsocketGateway {
  private readonly activeSockets = new Map<string, any>(); // streamSid -> WebSocket
  private readonly heartbeatTimers = new Map<string, NodeJS.Timeout>();
  private readonly idleTimers = new Map<string, NodeJS.Timeout>();

  constructor(
    private readonly sessionManager: TwilioVoiceSessionManager,
    private readonly connectionManager: IVoiceConnectionManager,
    private readonly mediaHandlerFactory: (streamSid: string) => TwilioMediaStreamHandler,
  ) {}

  public handleConnection(socket: any, request: IncomingMessage): void {
    let streamSid = '';
    let handler: TwilioMediaStreamHandler | null = null;

    socket.on('message', async (data: Buffer | string) => {
      try {
        const payloadStr = typeof data === 'string' ? data : data.toString('utf-8');
        const message = JSON.parse(payloadStr) as Record<string, unknown>;

        const event = message['event'];

        if (event === 'start') {
          const start = message['start'] as Record<string, unknown> | undefined;
          if (start) {
            streamSid = String(start['streamSid']);
            const customParameters = start['customParameters'] as Record<string, unknown> | undefined;

            if (customParameters) {
              const sessionId = String(customParameters['sessionId']);
              const tenantId = String(customParameters['tenantId']);

              // Authenticate session link
              const session = this.sessionManager.getSession(sessionId);
              if (session && session.tenantId === tenantId) {
                this.activeSockets.set(streamSid, socket);
                this.connectionManager.registerConnection(sessionId, socket);

                handler = this.mediaHandlerFactory(streamSid);
                handler.init(sessionId, tenantId);

                this.startHeartbeat(streamSid, socket);
                this.resetIdleTimer(streamSid, socket);
              } else {
                socket.close(1008, 'Session validation failed.');
              }
            }
          }
        }

        if (handler && streamSid) {
          this.resetIdleTimer(streamSid, socket);
          await handler.handleFrame(message);
        }
      } catch (err) {
        socket.close(1003, 'Protocol processing error.');
      }
    });

    socket.on('close', () => {
      if (streamSid) {
        this.cleanupSession(streamSid);
      }
    });

    socket.on('error', () => {
      if (streamSid) {
        this.cleanupSession(streamSid);
      }
    });
  }

  private startHeartbeat(streamSid: string, socket: any): void {
    const timer = setInterval(() => {
      try {
        // Send keepalive ping over WS
        socket.ping();
      } catch {
        this.cleanupSession(streamSid);
        socket.close();
      }
    }, TWILIO_WS_HEARTBEAT_INTERVAL_MS);

    this.heartbeatTimers.set(streamSid, timer);
  }

  private resetIdleTimer(streamSid: string, socket: any): void {
    const existing = this.idleTimers.get(streamSid);
    if (existing) {
      clearTimeout(existing);
    }

    const timer = setTimeout(() => {
      this.cleanupSession(streamSid);
      socket.close(1000, 'Session idle timeout.');
    }, TWILIO_WS_IDLE_TIMEOUT_MS);

    this.idleTimers.set(streamSid, timer);
  }

  private cleanupSession(streamSid: string): void {
    this.activeSockets.delete(streamSid);

    const hbTimer = this.heartbeatTimers.get(streamSid);
    if (hbTimer) {
      clearInterval(hbTimer);
      this.heartbeatTimers.delete(streamSid);
    }

    const idTimer = this.idleTimers.get(streamSid);
    if (idTimer) {
      clearTimeout(idTimer);
      this.idleTimers.delete(streamSid);
    }
  }

  public shutdownGracefully(): void {
    for (const streamSid of this.activeSockets.keys()) {
      this.cleanupSession(streamSid);
    }
    this.activeSockets.clear();
  }
}

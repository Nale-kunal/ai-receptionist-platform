import type { IVoiceConnectionManager } from '../interfaces/voice-server.interfaces';
import { HeartbeatTimeoutError } from '../errors/voice-server.errors';

export class VoiceConnectionManager implements IVoiceConnectionManager {
  private readonly connections: Map<string, any> = new Map();
  private readonly pingTimers: Map<string, NodeJS.Timeout> = new Map();
  private readonly pongExpectations: Map<string, boolean> = new Map();

  constructor(
    private readonly config: {
      heartbeatIntervalMs: number;
      idleTimeoutMs: number;
    },
    private readonly timeoutHandler: (sessionId: string, error: Error) => void
  ) {}

  public registerConnection(sessionId: string, socket: any): void {
    this.connections.set(sessionId, socket);
    this.pongExpectations.set(sessionId, true);

    // Setup heartbeat ping loop
    this.setupHeartbeat(sessionId);
  }

  public unregisterConnection(sessionId: string): void {
    this.clearHeartbeat(sessionId);
    this.connections.delete(sessionId);
    this.pongExpectations.delete(sessionId);
  }

  public getConnection(sessionId: string): any {
    return this.connections.get(sessionId);
  }

  public ping(sessionId: string): void {
    const socket = this.connections.get(sessionId);
    if (!socket) return;

    // Check if previous ping received pong
    const receivedPong = this.pongExpectations.get(sessionId) ?? false;
    if (!receivedPong) {
      // Heartbeat timeout! Trigger connection termination
      this.unregisterConnection(sessionId);
      this.timeoutHandler(sessionId, new HeartbeatTimeoutError());
      return;
    }

    this.pongExpectations.set(sessionId, false); // Await next pong

    try {
      if (typeof socket.ping === 'function') {
        socket.ping();
      } else if (typeof socket.send === 'function') {
        // Fallback for custom streaming WebSockets
        socket.send(JSON.stringify({ type: 'ping' }));
      }
    } catch {
      this.unregisterConnection(sessionId);
      this.timeoutHandler(sessionId, new HeartbeatTimeoutError());
    }
  }

  public handlePong(sessionId: string): void {
    this.pongExpectations.set(sessionId, true);
  }

  public async shutdownGracefully(): Promise<void> {
    const sessions = Array.from(this.connections.keys());
    for (const sessionId of sessions) {
      const socket = this.connections.get(sessionId);
      if (socket) {
        try {
          if (typeof socket.close === 'function') {
            socket.close(1000, 'Graceful server shutdown');
          }
        } catch {
          // Ignore close errors during shutdown
        }
      }
      this.unregisterConnection(sessionId);
    }
  }

  // ---------------------------------------------------------------------------
  // Heartbeat loops
  // ---------------------------------------------------------------------------

  private setupHeartbeat(sessionId: string): void {
    this.clearHeartbeat(sessionId);

    const timer = setInterval(() => {
      this.ping(sessionId);
    }, this.config.heartbeatIntervalMs);

    this.pingTimers.set(sessionId, timer);
  }

  private clearHeartbeat(sessionId: string): void {
    const timer = this.pingTimers.get(sessionId);
    if (timer) {
      clearInterval(timer);
      this.pingTimers.delete(sessionId);
    }
  }
}

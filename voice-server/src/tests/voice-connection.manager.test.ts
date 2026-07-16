import { VoiceConnectionManager } from '../services/voice-connection.manager';
import { HeartbeatTimeoutError } from '../errors/voice-server.errors';

class MockSocket {
  public pingCount = 0;
  public closeCount = 0;
  public sendCount = 0;

  public ping(): void {
    this.pingCount++;
  }

  public send(msg: string): void {
    this.sendCount++;
  }

  public close(code?: number, reason?: string): void {
    this.closeCount++;
  }
}

describe('VoiceConnectionManager', () => {
  let manager: VoiceConnectionManager;
  let timeoutError: Error | null = null;
  let timeoutSession: string | null = null;

  beforeEach(() => {
    timeoutError = null;
    timeoutSession = null;
    manager = new VoiceConnectionManager(
      { heartbeatIntervalMs: 100, idleTimeoutMs: 500 },
      (sessionId, err) => {
        timeoutSession = sessionId;
        timeoutError = err;
      }
    );
  });

  afterEach(async () => {
    await manager.shutdownGracefully();
  });

  it('registers and pings active connections', () => {
    const socket = new MockSocket();
    manager.registerConnection('s1', socket);

    expect(manager.getConnection('s1')).toBe(socket);

    // Call manual ping
    manager.ping('s1');
    expect(socket.pingCount).toBe(1);
  });

  it('triggers error handler if pong is not received prior to next ping', () => {
    const socket = new MockSocket();
    manager.registerConnection('s1', socket);

    // First ping (resets pong expectation)
    manager.ping('s1');
    expect(timeoutError).toBeNull();

    // Second ping without handlePong -> trigger heartbeat timeout
    manager.ping('s1');
    expect(timeoutSession).toBe('s1');
    expect(timeoutError).toBeInstanceOf(HeartbeatTimeoutError);
  });

  it('maintains ping loop if handlePong is called between pings', () => {
    const socket = new MockSocket();
    manager.registerConnection('s1', socket);

    manager.ping('s1');
    manager.handlePong('s1');
    manager.ping('s1');

    expect(timeoutError).toBeNull();
    expect(socket.pingCount).toBe(2);
  });

  it('shutdown closes all active connections gracefully', async () => {
    const socket1 = new MockSocket();
    const socket2 = new MockSocket();

    manager.registerConnection('s1', socket1);
    manager.registerConnection('s2', socket2);

    await manager.shutdownGracefully();

    expect(socket1.closeCount).toBe(1);
    expect(socket2.closeCount).toBe(1);
    expect(manager.getConnection('s1')).toBeUndefined();
  });
});

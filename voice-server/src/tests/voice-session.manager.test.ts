import { VoiceSessionManager } from '../sessions/voice-session.manager';
import { VoiceSessionNotFoundError } from '../errors/voice-server.errors';

describe('VoiceSessionManager', () => {
  let manager: VoiceSessionManager;
  const config = { rateLimitSessionsPerMinute: 3 };

  beforeEach(() => {
    manager = new VoiceSessionManager(config);
  });

  it('creates and tracks new voice sessions', async () => {
    const session = await manager.createSession({
      tenantId: 'tenant-123',
      clinicId: 'clinic-456',
      provider: 'mock-provider',
      providerCallId: 'call-789',
    });

    expect(session.sessionId).toContain('vses_');
    expect(session.tenantId).toBe('tenant-123');
    expect(session.clinicId).toBe('clinic-456');
    expect(session.connectionState).toBe('CREATED');
    expect(session.streamState).toBe('idle');
  });

  it('updates states and stream status successfully', async () => {
    const session = await manager.createSession({
      tenantId: 'tenant-123',
      clinicId: null,
      provider: 'mock',
      providerCallId: 'call-1',
    });

    const updated = await manager.updateSessionState(session.sessionId, 'tenant-123', 'CONNECTING');
    expect(updated.connectionState).toBe('CONNECTING');

    const streamed = await manager.updateStreamState(session.sessionId, 'tenant-123', 'bidirectional');
    expect(streamed.streamState).toBe('bidirectional');
  });

  it('enforces multi-tenant isolation on lookups and updates', async () => {
    const session = await manager.createSession({
      tenantId: 'tenant-123',
      clinicId: null,
      provider: 'mock',
      providerCallId: 'call-1',
    });

    await expect(manager.getSession(session.sessionId, 'tenant-999')).rejects.toThrow(VoiceSessionNotFoundError);
    await expect(manager.updateSessionState(session.sessionId, 'tenant-999', 'CONNECTING')).rejects.toThrow(
      VoiceSessionNotFoundError
    );
  });

  it('lists only active sessions', async () => {
    const session1 = await manager.createSession({ tenantId: 't1', clinicId: null, provider: 'mock', providerCallId: 'c1' });
    const session2 = await manager.createSession({ tenantId: 't1', clinicId: null, provider: 'mock', providerCallId: 'c2' });

    // End session 2
    await manager.updateSessionState(session2.sessionId, 't1', 'CONNECTING');
    await manager.updateSessionState(session2.sessionId, 't1', 'ENDED');

    const list = await manager.listActiveSessions('t1');
    expect(list.map((s) => s.sessionId)).toContain(session1.sessionId);
    expect(list.map((s) => s.sessionId)).not.toContain(session2.sessionId);
  });

  it('applies tenant creation rate limits', () => {
    expect(manager.rateLimitCheck('t1')).toBe(true);
    manager.createSession({ tenantId: 't1', clinicId: null, provider: 'mock', providerCallId: 'c1' });
    manager.createSession({ tenantId: 't1', clinicId: null, provider: 'mock', providerCallId: 'c2' });
    manager.createSession({ tenantId: 't1', clinicId: null, provider: 'mock', providerCallId: 'c3' });

    // 4th session creation exceeds rate-limit of 3
    expect(manager.rateLimitCheck('t1')).toBe(false);
  });
});

import { RealtimeSessionManager } from '../services/realtime-session.manager';
import { RealtimeSessionNotFoundError } from '../errors/realtime-ai.errors';

describe('RealtimeSessionManager', () => {
  let manager: RealtimeSessionManager;
  const config = { rateLimitSessionsPerMinute: 3 };

  beforeEach(() => {
    manager = new RealtimeSessionManager(config);
  });

  it('creates and tracks new realtime sessions', async () => {
    const session = await manager.createSession({
      tenantId: 'tenant-abc',
      clinicId: 'clinic-def',
      conversationId: '11111111-1111-1111-1111-111111111111',
      provider: 'mock',
      providerSessionId: 'provider-ses-1',
    });

    expect(session.sessionId).toContain('rt_ses_');
    expect(session.tenantId).toBe('tenant-abc');
    expect(session.clinicId).toBe('clinic-def');
    expect(session.connectionState).toBe('CREATED');
  });

  it('updates session states successfully', async () => {
    const session = await manager.createSession({
      tenantId: 'tenant-abc',
      clinicId: null,
      conversationId: '11111111-1111-1111-1111-111111111111',
      provider: 'mock',
      providerSessionId: 'provider-ses-1',
    });

    const updated = await manager.updateSessionState(session.sessionId, 'tenant-abc', 'CONNECTING');
    expect(updated.connectionState).toBe('CONNECTING');
  });

  it('enforces tenant isolation on lookups and state updates', async () => {
    const session = await manager.createSession({
      tenantId: 'tenant-abc',
      clinicId: null,
      conversationId: '11111111-1111-1111-1111-111111111111',
      provider: 'mock',
      providerSessionId: 'provider-ses-1',
    });

    await expect(manager.getSession(session.sessionId, 'tenant-xyz')).rejects.toThrow(RealtimeSessionNotFoundError);
    await expect(manager.updateSessionState(session.sessionId, 'tenant-xyz', 'CONNECTING')).rejects.toThrow(
      RealtimeSessionNotFoundError
    );
  });

  it('filters active sessions', async () => {
    const session1 = await manager.createSession({
      tenantId: 't1', clinicId: null, conversationId: '11111111-1111-1111-1111-111111111111', provider: 'mock', providerSessionId: 'p1'
    });
    const session2 = await manager.createSession({
      tenantId: 't1', clinicId: null, conversationId: '11111111-1111-1111-1111-111111111111', provider: 'mock', providerSessionId: 'p2'
    });

    await manager.updateSessionState(session2.sessionId, 't1', 'CONNECTING');
    await manager.updateSessionState(session2.sessionId, 't1', 'ENDED');

    const active = await manager.listActiveSessions('t1');
    expect(active.map((s) => s.sessionId)).toContain(session1.sessionId);
    expect(active.map((s) => s.sessionId)).not.toContain(session2.sessionId);
  });

  it('enforces tenant creation rate limits', () => {
    expect(manager.rateLimitCheck('t1')).toBe(true);
    manager.createSession({ tenantId: 't1', clinicId: null, conversationId: '11111111-1111-1111-1111-111111111111', provider: 'mock', providerSessionId: 'p1' });
    manager.createSession({ tenantId: 't1', clinicId: null, conversationId: '11111111-1111-1111-1111-111111111111', provider: 'mock', providerSessionId: 'p2' });
    manager.createSession({ tenantId: 't1', clinicId: null, conversationId: '11111111-1111-1111-1111-111111111111', provider: 'mock', providerSessionId: 'p3' });

    expect(manager.rateLimitCheck('t1')).toBe(false);
  });
});

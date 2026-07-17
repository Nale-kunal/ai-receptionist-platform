/**
 * OpenAI Realtime Provider — Session Manager Tests
 */

import { OpenAiRealtimeSessionManager } from '../openai-realtime.session.manager';
import { OpenAiSessionAlreadyExistsError, OpenAiSessionNotFoundError } from '../openai-realtime.errors';

describe('OpenAiRealtimeSessionManager', () => {
  let manager: OpenAiRealtimeSessionManager;

  beforeEach(() => {
    manager = new OpenAiRealtimeSessionManager();
  });

  // -----------------------------------------------------------------------
  // Creation
  // -----------------------------------------------------------------------

  describe('create()', () => {
    it('creates a session with default values', () => {
      const session = manager.create('sess-1');
      expect(session.sessionId).toBe('sess-1');
      expect(session.model).toBe('gpt-4o-realtime-preview');
      expect(session.voice).toBe('alloy');
      expect(session.instructions).toBe('');
      expect(session.tools).toEqual([]);
      expect(session.temperature).toBe(0.8);
      expect(session.audioInboundSequence).toBe(0);
      expect(session.audioOutboundSequence).toBe(0);
      expect(session.inputTokensConsumed).toBe(0);
      expect(session.outputTokensConsumed).toBe(0);
    });

    it('creates a session with custom values', () => {
      const session = manager.create('sess-2', {
        model: 'gpt-4o-mini-realtime-preview',
        voice: 'nova',
        instructions: 'You are a dental receptionist.',
        tools: [{ type: 'function', name: 'book_appointment' }],
        temperature: 0.5,
      });
      expect(session.model).toBe('gpt-4o-mini-realtime-preview');
      expect(session.voice).toBe('nova');
      expect(session.instructions).toBe('You are a dental receptionist.');
      expect(session.tools).toHaveLength(1);
      expect(session.temperature).toBe(0.5);
    });

    it('throws SessionAlreadyExists for duplicate id', () => {
      manager.create('sess-3');
      expect(() => manager.create('sess-3')).toThrow(OpenAiSessionAlreadyExistsError);
    });
  });

  // -----------------------------------------------------------------------
  // Retrieval
  // -----------------------------------------------------------------------

  describe('get()', () => {
    it('returns the session', () => {
      manager.create('sess-4');
      const session = manager.get('sess-4');
      expect(session.sessionId).toBe('sess-4');
    });

    it('throws SessionNotFound for unknown id', () => {
      expect(() => manager.get('unknown')).toThrow(OpenAiSessionNotFoundError);
    });
  });

  // -----------------------------------------------------------------------
  // Update
  // -----------------------------------------------------------------------

  describe('update()', () => {
    it('updates session fields', () => {
      manager.create('sess-5', { instructions: 'old instructions' });
      manager.update('sess-5', { instructions: 'new instructions' });
      const session = manager.get('sess-5');
      expect(session.instructions).toBe('new instructions');
    });

    it('updates lastActivityAt', async () => {
      manager.create('sess-6');
      const before = manager.get('sess-6').lastActivityAt;
      await new Promise<void>((r) => setTimeout(r, 5));
      manager.update('sess-6', { temperature: 0.9 });
      const after = manager.get('sess-6').lastActivityAt;
      expect(after).toBeGreaterThan(before);
    });
  });

  // -----------------------------------------------------------------------
  // Remove
  // -----------------------------------------------------------------------

  describe('remove()', () => {
    it('removes a session', () => {
      manager.create('sess-7');
      manager.remove('sess-7');
      expect(manager.has('sess-7')).toBe(false);
    });

    it('is idempotent for nonexistent sessions', () => {
      expect(() => manager.remove('ghost')).not.toThrow();
    });
  });

  // -----------------------------------------------------------------------
  // Token Usage
  // -----------------------------------------------------------------------

  describe('recordTokenUsage()', () => {
    it('accumulates token counts correctly', () => {
      manager.create('sess-8');
      manager.recordTokenUsage('sess-8', 100, 200);
      manager.recordTokenUsage('sess-8', 50, 75);
      const session = manager.get('sess-8');
      expect(session.inputTokensConsumed).toBe(150);
      expect(session.outputTokensConsumed).toBe(275);
    });

    it('ignores unknown sessions gracefully', () => {
      expect(() => manager.recordTokenUsage('ghost', 10, 20)).not.toThrow();
    });
  });

  // -----------------------------------------------------------------------
  // Audio Sequences
  // -----------------------------------------------------------------------

  describe('Audio sequence counters', () => {
    it('increments inbound sequence monotonically', () => {
      manager.create('sess-9');
      const sequences = Array.from({ length: 5 }, () => manager.nextInboundSequence('sess-9'));
      expect(sequences).toEqual([0, 1, 2, 3, 4]);
    });

    it('increments outbound sequence monotonically', () => {
      manager.create('sess-10');
      const sequences = Array.from({ length: 3 }, () => manager.nextOutboundSequence('sess-10'));
      expect(sequences).toEqual([0, 1, 2]);
    });

    it('wraps sequence at uint32 max', () => {
      manager.create('sess-11');
      manager.update('sess-11', { audioInboundSequence: 2 ** 32 - 1 });
      const seq = manager.nextInboundSequence('sess-11');
      expect(seq).toBe(2 ** 32 - 1);
      const next = manager.nextInboundSequence('sess-11');
      expect(next).toBe(0); // wrapped
    });
  });

  // -----------------------------------------------------------------------
  // Active Count
  // -----------------------------------------------------------------------

  describe('activeCount()', () => {
    it('tracks correct count across lifecycle', () => {
      expect(manager.activeCount()).toBe(0);
      manager.create('s1');
      manager.create('s2');
      expect(manager.activeCount()).toBe(2);
      manager.remove('s1');
      expect(manager.activeCount()).toBe(1);
    });
  });
});

/**
 * OpenAI Realtime Provider — Audio Stream Tests
 */

import { OpenAiRealtimeAudioStream } from '../openai-realtime.audio.stream';
import { OpenAiAudioStreamClosedError, OpenAiAudioPayloadTooLargeError } from '../openai-realtime.errors';
import type { RealtimeAudioFrame } from '../../realtime-ai-adapter/types/realtime-ai.types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeAudioChunk(sessionId: string, sequence: number) {
  return {
    sessionId,
    sequence,
    timestamp: Date.now(),
    base64Audio: Buffer.alloc(100, 0x10).toString('base64'),
    codec: 'audio/pcm16',
    durationMs: 20,
  };
}

function makeAudioFrame(sequence: number): RealtimeAudioFrame {
  return {
    sequence,
    timestamp: Date.now(),
    payload: Buffer.alloc(100, 0x20),
    codec: 'audio/pcm16',
    durationMs: 20,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('OpenAiRealtimeAudioStream', () => {
  let stream: OpenAiRealtimeAudioStream;

  beforeEach(() => {
    stream = new OpenAiRealtimeAudioStream(200);
  });

  // -----------------------------------------------------------------------
  // Session Initialization
  // -----------------------------------------------------------------------

  describe('initSession() / close()', () => {
    it('initializes a session for use', () => {
      stream.initSession('sess-1');
      expect(stream.inboundBufferSize('sess-1')).toBe(0);
    });

    it('is idempotent for duplicate init', () => {
      stream.initSession('sess-dup');
      stream.initSession('sess-dup'); // should not throw
      expect(stream.inboundBufferSize('sess-dup')).toBe(0);
    });

    it('close() clears the session', () => {
      stream.initSession('sess-close');
      stream.pushInboundFrame(makeAudioChunk('sess-close', 0));
      stream.close('sess-close');
      // After close, buffer is gone
      expect(stream.inboundBufferSize('sess-close')).toBe(0);
    });
  });

  // -----------------------------------------------------------------------
  // Inbound (Telephony → OpenAI)
  // -----------------------------------------------------------------------

  describe('pushInboundFrame() / inboundFrames()', () => {
    it('yields pushed frames in order', async () => {
      stream.initSession('sess-2');
      for (let i = 0; i < 5; i++) {
        stream.pushInboundFrame(makeAudioChunk('sess-2', i));
      }
      // Close to terminate the generator
      setImmediate(() => stream.close('sess-2'));

      const received = [];
      for await (const chunk of stream.inboundFrames('sess-2')) {
        received.push(chunk.sequence);
      }
      expect(received).toEqual([0, 1, 2, 3, 4]);
    });

    it('throws for unknown session (closed or uninitialized)', () => {
      expect(() => stream.pushInboundFrame(makeAudioChunk('unknown', 0)))
        .toThrow(OpenAiAudioStreamClosedError);
    });

    it('rejects oversized payloads', () => {
      stream.initSession('sess-oversize');
      const bigAudio = Buffer.alloc(200_000, 0xff).toString('base64');
      expect(() =>
        stream.pushInboundFrame({
          sessionId: 'sess-oversize',
          sequence: 0,
          timestamp: 0,
          base64Audio: bigAudio,
          codec: 'audio/pcm16',
          durationMs: 20,
        }),
      ).toThrow(OpenAiAudioPayloadTooLargeError);
    });

    it('applies ring buffer — drops oldest frame when buffer full', () => {
      const ringStream = new OpenAiRealtimeAudioStream(3); // max 3 frames
      ringStream.initSession('ring-sess');
      for (let i = 0; i < 5; i++) {
        ringStream.pushInboundFrame(makeAudioChunk('ring-sess', i));
      }
      // Buffer should hold only last 3 frames (sequences 2,3,4)
      expect(ringStream.inboundBufferSize('ring-sess')).toBe(3);
    });
  });

  // -----------------------------------------------------------------------
  // Outbound (OpenAI → Telephony)
  // -----------------------------------------------------------------------

  describe('pushOutboundFrameForSession() / outboundFrames()', () => {
    it('yields outbound audio frames in order', async () => {
      stream.initSession('sess-3');
      for (let i = 0; i < 3; i++) {
        stream.pushOutboundFrameForSession('sess-3', makeAudioFrame(i));
      }
      setImmediate(() => stream.close('sess-3'));

      const received = [];
      for await (const frame of stream.outboundFrames('sess-3')) {
        received.push(frame.sequence);
      }
      expect(received).toEqual([0, 1, 2]);
    });

    it('silently drops frames for closed sessions', () => {
      stream.initSession('sess-4');
      stream.close('sess-4');
      expect(() =>
        stream.pushOutboundFrameForSession('sess-4', makeAudioFrame(0)),
      ).not.toThrow();
    });
  });

  // -----------------------------------------------------------------------
  // Codec Helpers
  // -----------------------------------------------------------------------

  describe('encodeToBase64() / decodeFromBase64()', () => {
    it('round-trips a buffer through base64 encoding', () => {
      const original = Buffer.from([0x10, 0x20, 0x30, 0x40]);
      const base64 = OpenAiRealtimeAudioStream.encodeToBase64(original);
      const frame = OpenAiRealtimeAudioStream.decodeFromBase64(base64, 'sess-codec', 1);
      expect(frame.payload).toEqual(original);
      expect(frame.sequence).toBe(1);
      expect(frame.codec).toBe('audio/pcm16');
    });
  });
});

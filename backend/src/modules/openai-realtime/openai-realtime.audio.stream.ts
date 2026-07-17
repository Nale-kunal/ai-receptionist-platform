/**
 * OpenAI Realtime Provider — Audio Stream
 *
 * Manages bidirectional audio streaming between telephony and OpenAI.
 *
 * Inbound (Telephony → OpenAI):
 *   Caller audio arrives as PCM/G.711 Buffer frames.
 *   The stream encodes them to base64 and sequences them for OpenAI.
 *
 * Outbound (OpenAI → Telephony):
 *   OpenAI audio deltas arrive as base64 strings.
 *   The stream decodes them to Buffer and yields RealtimeAudioFrame.
 *
 * Design: Async generator-based backpressure with bounded ring buffer.
 */

import type { RealtimeAudioFrame } from '../realtime-ai-adapter/types/realtime-ai.types';
import type { IOpenAiAudioStream } from './openai-realtime.interfaces';
import type { OpenAiAudioChunk } from './openai-realtime.types';
import { OpenAiAudioStreamClosedError, OpenAiAudioPayloadTooLargeError } from './openai-realtime.errors';
import { OPENAI_WS_PAYLOAD_MAX_BYTES, OPENAI_AUDIO_CHUNK_DURATION_MS } from './openai-realtime.constants';

// ---------------------------------------------------------------------------
// Per-Session Audio Buffer
// ---------------------------------------------------------------------------

interface AudioBuffer {
  inboundQueue: OpenAiAudioChunk[];
  outboundQueue: RealtimeAudioFrame[];
  inboundResolvers: Array<() => void>;
  outboundResolvers: Array<() => void>;
  closed: boolean;
}

// ---------------------------------------------------------------------------
// Audio Stream Implementation
// ---------------------------------------------------------------------------

export class OpenAiRealtimeAudioStream implements IOpenAiAudioStream {
  private readonly buffers = new Map<string, AudioBuffer>();
  private readonly maxBufferSize: number;

  constructor(maxBufferSize = 1000) {
    this.maxBufferSize = maxBufferSize;
  }

  // ---------------------------------------------------------------------------
  // Session Lifecycle
  // ---------------------------------------------------------------------------

  public initSession(sessionId: string): void {
    if (!this.buffers.has(sessionId)) {
      this.buffers.set(sessionId, {
        inboundQueue: [],
        outboundQueue: [],
        inboundResolvers: [],
        outboundResolvers: [],
        closed: false,
      });
    }
  }

  public close(sessionId: string): void {
    const buf = this.buffers.get(sessionId);
    if (!buf) return;
    buf.closed = true;
    // Wake up all waiting generators so they can terminate
    for (const r of buf.inboundResolvers) r();
    for (const r of buf.outboundResolvers) r();
    buf.inboundResolvers = [];
    buf.outboundResolvers = [];
    this.buffers.delete(sessionId);
  }

  // ---------------------------------------------------------------------------
  // Inbound (Telephony → OpenAI)
  // ---------------------------------------------------------------------------

  public pushInboundFrame(chunk: OpenAiAudioChunk): void {
    const buf = this.requireBuffer(chunk.sessionId);
    if (buf.closed) {
      throw new OpenAiAudioStreamClosedError(chunk.sessionId);
    }

    // Validate payload size
    const estimatedBytes = Math.ceil((chunk.base64Audio.length * 3) / 4);
    if (estimatedBytes > OPENAI_WS_PAYLOAD_MAX_BYTES) {
      throw new OpenAiAudioPayloadTooLargeError(estimatedBytes, OPENAI_WS_PAYLOAD_MAX_BYTES);
    }

    if (buf.inboundQueue.length >= this.maxBufferSize) {
      // Drop oldest frame to prevent memory exhaustion (ring buffer behavior)
      buf.inboundQueue.shift();
    }

    buf.inboundQueue.push(chunk);
    this.wakeResolvers(buf.inboundResolvers);
  }

  public async *inboundFrames(sessionId: string): AsyncIterable<OpenAiAudioChunk> {
    const buf = this.requireBuffer(sessionId);

    while (true) {
      if (buf.closed && buf.inboundQueue.length === 0) break;

      if (buf.inboundQueue.length > 0) {
        yield buf.inboundQueue.shift()!;
        continue;
      }

      // Wait for next frame
      await new Promise<void>((resolve) => {
        buf.inboundResolvers.push(resolve);
      });
    }
  }

  public inboundBufferSize(sessionId: string): number {
    return this.buffers.get(sessionId)?.inboundQueue.length ?? 0;
  }

  // ---------------------------------------------------------------------------
  // Outbound (OpenAI → Telephony)
  // ---------------------------------------------------------------------------

  public pushOutboundFrame(frame: RealtimeAudioFrame): void {
    const buf = this.buffers.get(frame.sequence.toString());
    // Frames are keyed by sessionId stored in the caller's context;
    // the caller passes the sessionId separately.
    // In practice, this is called from the event router which has the sessionId:
    // This overload accepts a (sessionId, frame) pattern.
    throw new Error('Use pushOutboundFrameForSession(sessionId, frame) instead.');
  }

  public pushOutboundFrameForSession(sessionId: string, frame: RealtimeAudioFrame): void {
    const buf = this.buffers.get(sessionId);
    if (!buf || buf.closed) return; // Silently drop if session ended

    if (buf.outboundQueue.length >= this.maxBufferSize) {
      buf.outboundQueue.shift(); // Ring buffer
    }

    buf.outboundQueue.push(frame);
    this.wakeResolvers(buf.outboundResolvers);
  }

  public async *outboundFrames(sessionId: string): AsyncIterable<RealtimeAudioFrame> {
    const buf = this.requireBuffer(sessionId);

    while (true) {
      if (buf.closed && buf.outboundQueue.length === 0) break;

      if (buf.outboundQueue.length > 0) {
        yield buf.outboundQueue.shift()!;
        continue;
      }

      await new Promise<void>((resolve) => {
        buf.outboundResolvers.push(resolve);
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  /**
   * Encode a raw audio Buffer to a base64 string for transmission to OpenAI.
   */
  public static encodeToBase64(buffer: Buffer): string {
    return buffer.toString('base64');
  }

  /**
   * Decode a base64 audio string from OpenAI into a Buffer.
   */
  public static decodeFromBase64(base64: string, sessionId: string, sequence: number): RealtimeAudioFrame {
    const payload = Buffer.from(base64, 'base64');
    return {
      sequence,
      timestamp: Date.now(),
      payload,
      codec: 'audio/pcm16',
      durationMs: OPENAI_AUDIO_CHUNK_DURATION_MS,
    };
  }

  private requireBuffer(sessionId: string): AudioBuffer {
    const buf = this.buffers.get(sessionId);
    if (!buf) {
      throw new OpenAiAudioStreamClosedError(sessionId);
    }
    return buf;
  }

  private wakeResolvers(resolvers: Array<() => void>): void {
    if (resolvers.length > 0) {
      const r = resolvers.shift()!;
      r();
    }
  }
}

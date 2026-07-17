/**
 * Twilio Voice Provider — Audio Stream Manager
 *
 * Encapsulates PCMU/mu-law audio processing.
 * Normalizes input chunks and handles buffering.
 */

import type { AudioFrame } from '../../types/voice-server.types';
import type { ITwilioAudioStream } from './twilio.interfaces';
import { InvalidFrameError } from '../../errors/voice-server.errors';
import { TWILIO_CODEC_MULAW, TWILIO_FRAME_DURATION_MS, TWILIO_WS_PAYLOAD_MAX_BYTES } from './twilio.constants';

export class TwilioAudioStream implements ITwilioAudioStream {
  private readonly outboundBuffers = new Map<string, Buffer[]>();

  public async pushInbound(
    base64Payload: string,
    sequence: number,
    timestamp: number,
  ): Promise<AudioFrame> {
    const rawBuffer = Buffer.from(base64Payload, 'base64');
    if (rawBuffer.length === 0) {
      throw new InvalidFrameError('Payload size cannot be zero.');
    }
    if (rawBuffer.length > TWILIO_WS_PAYLOAD_MAX_BYTES) {
      throw new InvalidFrameError(`Payload size ${rawBuffer.length} exceeds maximum limit.`);
    }

    return {
      sequence,
      timestamp,
      payload: rawBuffer,
      codec: TWILIO_CODEC_MULAW,
      durationMs: TWILIO_FRAME_DURATION_MS,
    };
  }

  public async popOutbound(sessionId: string): Promise<Buffer | null> {
    const bufferQueue = this.outboundBuffers.get(sessionId);
    if (!bufferQueue || bufferQueue.length === 0) {
      return null;
    }
    return bufferQueue.shift() ?? null;
  }

  public pushOutbound(sessionId: string, payload: Buffer): void {
    let queue = this.outboundBuffers.get(sessionId);
    if (!queue) {
      queue = [];
      this.outboundBuffers.set(sessionId, queue);
    }
    queue.push(payload);
  }

  public close(sessionId: string): void {
    this.outboundBuffers.delete(sessionId);
  }
}

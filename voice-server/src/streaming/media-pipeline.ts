import type { IMediaPipeline } from '../interfaces/voice-server.interfaces';
import type { AudioFrame } from '../types/voice-server.types';
import { InvalidFrameError, UnsupportedCodecError } from '../errors/voice-server.errors';

export class MediaPipeline implements IMediaPipeline {
  private readonly codecPreferences: string[];
  private readonly maxPayloadSize: number;
  private readonly jitterDelayMs: number;

  // Track sequence expectations per session: sessionId -> lastSequenceReceived
  private readonly sessionSequences: Map<string, number> = new Map();
  // Track dropped frame counts per session: sessionId -> droppedFrames
  private readonly sessionDroppedFrames: Map<string, number> = new Map();
  // Total dropped frames across all pipelines
  private totalDroppedFrames = 0;

  constructor(config: {
    codecPreferences: string[];
    maxPayloadSizeBytes: number;
    jitterBufferMs: number;
  }) {
    this.codecPreferences = config.codecPreferences;
    this.maxPayloadSize = config.maxPayloadSizeBytes;
    this.jitterDelayMs = config.jitterBufferMs;
  }

  public async processInboundFrame(
    sessionId: string,
    rawPayload: Buffer,
    sequence: number
  ): Promise<AudioFrame> {
    this.validatePayloadSize(rawPayload);

    const codec = this.codecPreferences[0] ?? 'audio/PCMU'; // Default codec
    const frameSizeMs = 20; // 20ms standard frames

    // Track sequence and check for drops/duplicates
    const lastSeq = this.sessionSequences.get(sessionId) ?? 0;
    if (sequence > lastSeq + 1 && lastSeq > 0) {
      const droppedCount = sequence - lastSeq - 1;
      const currentDropped = this.sessionDroppedFrames.get(sessionId) ?? 0;
      this.sessionDroppedFrames.set(sessionId, currentDropped + droppedCount);
      this.totalDroppedFrames += droppedCount;
    }
    this.sessionSequences.set(sessionId, sequence);

    // Relational timestamp mapping based on sequence
    const timestamp = sequence * frameSizeMs;

    return {
      sequence,
      timestamp,
      payload: rawPayload,
      codec,
      durationMs: frameSizeMs,
    };
  }

  public async processOutboundFrame(
    sessionId: string,
    rawPayload: Buffer,
    sequence: number
  ): Promise<AudioFrame> {
    this.validatePayloadSize(rawPayload);

    const codec = this.codecPreferences[0] ?? 'audio/PCMU';
    const frameSizeMs = 20;
    const timestamp = sequence * frameSizeMs;

    return {
      sequence,
      timestamp,
      payload: rawPayload,
      codec,
      durationMs: frameSizeMs,
    };
  }

  public getJitterDelayMs(): number {
    return this.jitterDelayMs;
  }

  public getDroppedFramesCount(): number {
    return this.totalDroppedFrames;
  }

  public async normalizeCodec(
    payload: Buffer,
    sourceCodec: string,
    targetCodec: string
  ): Promise<Buffer> {
    if (!this.codecPreferences.includes(sourceCodec)) {
      throw new UnsupportedCodecError(sourceCodec, this.codecPreferences);
    }
    if (!this.codecPreferences.includes(targetCodec)) {
      throw new UnsupportedCodecError(targetCodec, this.codecPreferences);
    }

    // In a provider-agnostic core skeleton, we handle matching codecs directly (no-op conversion).
    // Future concrete transcoding engine adapters can override this method.
    return payload;
  }

  // ---------------------------------------------------------------------------
  // Validation
  // ---------------------------------------------------------------------------

  private validatePayloadSize(payload: Buffer): void {
    if (payload.length > this.maxPayloadSize) {
      throw new InvalidFrameError(`Payload size ${payload.length} exceeds maximum limits of ${this.maxPayloadSize} bytes.`);
    }
    if (payload.length === 0) {
      throw new InvalidFrameError('Payload size cannot be zero.');
    }
  }
}

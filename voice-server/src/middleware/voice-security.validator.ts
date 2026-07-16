import { InvalidFrameError, UnauthorizedProviderError } from '../errors/voice-server.errors';

export class VoiceSecurityValidator {
  private readonly maxPayloadSize: number;
  // Simple in-memory tracker for replay attacks (session ID -> seen sequence numbers)
  private readonly seenSequences: Map<string, Set<number>> = new Map();

  constructor(config: { maxPayloadSizeBytes: number }) {
    this.maxPayloadSize = config.maxPayloadSizeBytes;
  }

  /**
   * Validates raw frame bytes and payload integrity
   */
  public validateAudioFrame(
    sessionId: string,
    rawPayload: Buffer,
    sequence: number
  ): void {
    // 1. Oversized payload check
    if (rawPayload.length > this.maxPayloadSize) {
      throw new InvalidFrameError(
        `Payload size ${rawPayload.length} bytes exceeds the security limit of ${this.maxPayloadSize} bytes.`
      );
    }

    // 2. Empty payload check
    if (rawPayload.length === 0) {
      throw new InvalidFrameError('Payload cannot be empty.');
    }

    // 3. Replay attack check: check if sequence number was already processed
    let sequences = this.seenSequences.get(sessionId);
    if (!sequences) {
      sequences = new Set();
      this.seenSequences.set(sessionId, sequences);
    }

    if (sequences.has(sequence)) {
      throw new InvalidFrameError(
        `Security alarm: Audio sequence number ${sequence} received duplicate/replay packet.`,
        { sequence, sessionId }
      );
    }
    sequences.add(sequence);

    // Limit replay tracking size to prevent memory leak (sliding window of last 200 sequences)
    if (sequences.size > 200) {
      const minSeq = Math.min(...Array.from(sequences));
      sequences.delete(minSeq);
    }
  }

  /**
   * Validates provider authenticity
   */
  public validateProviderIdentity(
    provider: string,
    signature: string,
    expectedSecret: string
  ): void {
    if (!provider || !signature) {
      throw new UnauthorizedProviderError('Missing provider token or signature.');
    }

    // Provider signature checks
    if (signature !== expectedSecret) {
      throw new UnauthorizedProviderError(`Signature validation failed for provider ${provider}.`);
    }
  }

  /**
   * Cleans security context for closed sessions
   */
  public clearSessionContext(sessionId: string): void {
    this.seenSequences.delete(sessionId);
  }
}

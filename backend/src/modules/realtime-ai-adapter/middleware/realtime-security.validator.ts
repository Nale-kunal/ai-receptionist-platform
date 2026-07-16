import { RealtimeFrameOverflowError, RealtimeUnauthorizedProviderError } from '../errors/realtime-ai.errors';

export class RealtimeSecurityValidator {
  private readonly maxPayloadSize: number;
  private readonly seenSequences: Map<string, Set<number>> = new Map();

  constructor(config: { maxPayloadSizeBytes: number }) {
    this.maxPayloadSize = config.maxPayloadSizeBytes;
  }

  /**
   * Validate frame sizes and detect sequence duplication (replay check)
   */
  public validateFrame(sessionId: string, rawPayload: Buffer, sequence: number): void {
    if (rawPayload.length > this.maxPayloadSize) {
      throw new RealtimeFrameOverflowError(rawPayload.length, this.maxPayloadSize);
    }

    let list = this.seenSequences.get(sessionId);
    if (!list) {
      list = new Set();
      this.seenSequences.set(sessionId, list);
    }

    if (list.has(sequence)) {
      throw new Error(`[RealtimeSecurity] Replay attack detected. Sequence ${sequence} already processed.`);
    }
    list.add(sequence);

    // Limit memory footprint
    if (list.size > 200) {
      const minVal = Math.min(...Array.from(list));
      list.delete(minVal);
    }
  }

  /**
   * Validate provider credential parameters
   */
  public validateApiKey(apiKey: string): void {
    if (!apiKey || apiKey.trim().length < 16) {
      throw new RealtimeUnauthorizedProviderError('Invalid API key configuration length.');
    }
  }

  /**
   * Remove tracking context on socket termination
   */
  public clearSessionContext(sessionId: string): void {
    this.seenSequences.delete(sessionId);
  }
}

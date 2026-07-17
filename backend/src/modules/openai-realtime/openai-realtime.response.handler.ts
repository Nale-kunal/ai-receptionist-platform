/**
 * OpenAI Realtime Provider — Response Handler
 *
 * Normalizes OpenAI audio delta events into RealtimeAudioFrame.
 * Handles usage extraction from response.done events.
 */

import type { RealtimeAudioFrame } from '../realtime-ai-adapter/types/realtime-ai.types';
import type { OpenAiUsageSnapshot } from './openai-realtime.types';
import {
  OPENAI_EVENT_RESPONSE_AUDIO_DELTA,
  OPENAI_EVENT_RESPONSE_DONE,
  OPENAI_AUDIO_CHUNK_DURATION_MS,
} from './openai-realtime.constants';
import { OpenAiMalformedEventError } from './openai-realtime.errors';
import { OpenAiRealtimeAudioStream } from './openai-realtime.audio.stream';
import { OpenAiRealtimeSessionManager } from './openai-realtime.session.manager';

export class OpenAiResponseHandler {
  constructor(private readonly sessionManager: OpenAiRealtimeSessionManager) {}

  /**
   * Handle an audio delta event. Returns a decoded RealtimeAudioFrame.
   * Returns null for non-audio events.
   */
  public handleAudioDelta(
    sessionId: string,
    rawEvent: Record<string, unknown>,
  ): RealtimeAudioFrame | null {
    if (rawEvent['type'] !== OPENAI_EVENT_RESPONSE_AUDIO_DELTA) {
      return null;
    }

    const delta = rawEvent['delta'];
    if (typeof delta !== 'string' || delta.length === 0) {
      throw new OpenAiMalformedEventError(
        OPENAI_EVENT_RESPONSE_AUDIO_DELTA,
        '"delta" must be a non-empty base64 string.',
      );
    }

    const sequence = this.sessionManager.nextOutboundSequence(sessionId);
    return OpenAiRealtimeAudioStream.decodeFromBase64(delta, sessionId, sequence);
  }

  /**
   * Handle a response.done event. Extracts usage data.
   * Returns a usage snapshot or null.
   */
  public handleResponseDone(
    sessionId: string,
    rawEvent: Record<string, unknown>,
  ): OpenAiUsageSnapshot | null {
    if (rawEvent['type'] !== OPENAI_EVENT_RESPONSE_DONE) {
      return null;
    }

    const response = rawEvent['response'] as Record<string, unknown> | undefined;
    if (!response) return null;

    const usage = response['usage'] as Record<string, unknown> | undefined;
    if (!usage) return null;

    const inputTokens = typeof usage['input_tokens'] === 'number' ? usage['input_tokens'] : 0;
    const outputTokens = typeof usage['output_tokens'] === 'number' ? usage['output_tokens'] : 0;

    this.sessionManager.recordTokenUsage(sessionId, inputTokens, outputTokens);

    return {
      inputTokens,
      outputTokens,
      totalTokens: inputTokens + outputTokens,
      capturedAt: Date.now(),
    };
  }
}

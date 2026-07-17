/**
 * OpenAI Realtime Provider — Interruption Handler
 *
 * Normalizes OpenAI barge-in / speech detection events
 * into RealtimeInterruptionEvent.
 */

import type { RealtimeInterruptionEvent } from '../realtime-ai-adapter/types/realtime-ai.types';
import {
  OPENAI_EVENT_INPUT_AUDIO_BUFFER_SPEECH_STOPPED,
  OPENAI_EVENT_INPUT_AUDIO_BUFFER_SPEECH_STARTED,
} from './openai-realtime.constants';

export class OpenAiInterruptionHandler {
  /**
   * Returns a normalized interruption event when the user starts speaking
   * (barge-in / speech started) or when speech stops mid-response.
   * Returns null for non-interruption events.
   */
  public handle(
    rawEvent: Record<string, unknown>,
  ): RealtimeInterruptionEvent | null {
    const type = rawEvent['type'];

    // Speech started = barge-in / user interrupted the assistant
    if (type === OPENAI_EVENT_INPUT_AUDIO_BUFFER_SPEECH_STARTED) {
      const audioStartMs = typeof rawEvent['audio_start_ms'] === 'number'
        ? rawEvent['audio_start_ms']
        : Date.now();

      return {
        interruptedAtMs: audioStartMs,
        audioOffsetMs: 0,
      };
    }

    // Speech stopped = end of user utterance, used for turn detection
    // Not surfaced as an interruption — handled by VAD internally.
    if (type === OPENAI_EVENT_INPUT_AUDIO_BUFFER_SPEECH_STOPPED) {
      // We return this as an interruption event with offset to allow
      // the orchestrator to trim or cancel buffered assistant audio
      const audioEndMs = typeof rawEvent['audio_end_ms'] === 'number'
        ? rawEvent['audio_end_ms']
        : Date.now();

      return {
        interruptedAtMs: audioEndMs,
        audioOffsetMs: 0,
      };
    }

    return null;
  }
}

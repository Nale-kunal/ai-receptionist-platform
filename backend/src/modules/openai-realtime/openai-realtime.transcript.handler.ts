/**
 * OpenAI Realtime Provider — Transcript Handler
 *
 * Normalizes OpenAI transcript events into RealtimeTranscriptEvent.
 * Handles both user (input) and assistant (output) transcripts.
 */

import type { RealtimeTranscriptEvent } from '../realtime-ai-adapter/types/realtime-ai.types';
import {
  OPENAI_EVENT_CONVERSATION_ITEM_INPUT_AUDIO_TRANSCRIPTION_COMPLETED,
  OPENAI_EVENT_RESPONSE_AUDIO_TRANSCRIPT_DELTA,
  OPENAI_EVENT_RESPONSE_AUDIO_TRANSCRIPT_DONE,
  OPENAI_EVENT_RESPONSE_TEXT_DELTA,
  OPENAI_EVENT_RESPONSE_TEXT_DONE,
} from './openai-realtime.constants';
import { OpenAiMalformedEventError } from './openai-realtime.errors';

export class OpenAiTranscriptHandler {
  /**
   * Returns a normalized transcript event if the raw event is a transcript type.
   * Returns null for non-transcript events.
   */
  public handle(
    rawEvent: Record<string, unknown>,
  ): RealtimeTranscriptEvent | null {
    const type = rawEvent['type'];

    switch (type) {
      // User utterance — final transcript from input audio
      case OPENAI_EVENT_CONVERSATION_ITEM_INPUT_AUDIO_TRANSCRIPTION_COMPLETED:
        return this.normalizeUserFinalTranscript(rawEvent);

      // Assistant response — streaming partial transcript
      case OPENAI_EVENT_RESPONSE_AUDIO_TRANSCRIPT_DELTA:
      case OPENAI_EVENT_RESPONSE_TEXT_DELTA:
        return this.normalizeAssistantDeltaTranscript(rawEvent);

      // Assistant response — final transcript
      case OPENAI_EVENT_RESPONSE_AUDIO_TRANSCRIPT_DONE:
      case OPENAI_EVENT_RESPONSE_TEXT_DONE:
        return this.normalizeAssistantFinalTranscript(rawEvent);

      default:
        return null;
    }
  }

  // ---------------------------------------------------------------------------
  // Normalizers
  // ---------------------------------------------------------------------------

  private normalizeUserFinalTranscript(
    event: Record<string, unknown>,
  ): RealtimeTranscriptEvent {
    const transcript = event['transcript'];
    if (typeof transcript !== 'string') {
      throw new OpenAiMalformedEventError(
        String(event['type']),
        'Missing "transcript" string field.',
      );
    }
    return {
      text: transcript,
      isFinal: true,
      speaker: 'user',
    };
  }

  private normalizeAssistantDeltaTranscript(
    event: Record<string, unknown>,
  ): RealtimeTranscriptEvent {
    const delta = event['delta'];
    if (typeof delta !== 'string') {
      throw new OpenAiMalformedEventError(
        String(event['type']),
        'Missing "delta" string field.',
      );
    }
    return {
      text: delta,
      isFinal: false,
      speaker: 'assistant',
    };
  }

  private normalizeAssistantFinalTranscript(
    event: Record<string, unknown>,
  ): RealtimeTranscriptEvent {
    // Final events use 'transcript' for audio, 'text' for text modality
    const text = event['transcript'] ?? event['text'];
    if (typeof text !== 'string') {
      throw new OpenAiMalformedEventError(
        String(event['type']),
        'Missing "transcript" or "text" string field.',
      );
    }
    return {
      text,
      isFinal: true,
      speaker: 'assistant',
    };
  }
}

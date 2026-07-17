/**
 * OpenAI Realtime Provider — Tool Handler
 *
 * Normalizes OpenAI function call events into RealtimeToolCallEvent.
 * Handles streaming argument accumulation and final dispatch.
 */

import type { RealtimeToolCallEvent, RealtimeToolCall } from '../realtime-ai-adapter/types/realtime-ai.types';
import {
  OPENAI_EVENT_RESPONSE_FUNCTION_CALL_ARGUMENTS_DELTA,
  OPENAI_EVENT_RESPONSE_FUNCTION_CALL_ARGUMENTS_DONE,
} from './openai-realtime.constants';
import { OpenAiMalformedEventError } from './openai-realtime.errors';
import { validateToolCallDoneEvent } from './openai-realtime.validators';

// ---------------------------------------------------------------------------
// Argument Accumulator (handles streaming argument deltas)
// ---------------------------------------------------------------------------

interface AccumulatedCall {
  callId: string;
  name: string;
  argumentsBuffer: string;
}

export class OpenAiToolHandler {
  // Per-session accumulator: sessionId → callId → accumulated arguments
  private readonly accumulators = new Map<string, Map<string, AccumulatedCall>>();

  /**
   * Handle a raw OpenAI event. Returns a normalized tool call event
   * only when function call arguments are fully received (done event).
   * Returns null for argument delta events (accumulation in progress).
   */
  public handle(
    sessionId: string,
    rawEvent: Record<string, unknown>,
  ): RealtimeToolCallEvent | null {
    const type = rawEvent['type'];

    switch (type) {
      case OPENAI_EVENT_RESPONSE_FUNCTION_CALL_ARGUMENTS_DELTA:
        this.accumulateDelta(sessionId, rawEvent);
        return null; // Not yet complete

      case OPENAI_EVENT_RESPONSE_FUNCTION_CALL_ARGUMENTS_DONE:
        return this.finalizeDone(sessionId, rawEvent);

      default:
        return null;
    }
  }

  // ---------------------------------------------------------------------------
  // Internal
  // ---------------------------------------------------------------------------

  private getOrCreateSessionMap(sessionId: string): Map<string, AccumulatedCall> {
    let map = this.accumulators.get(sessionId);
    if (!map) {
      map = new Map<string, AccumulatedCall>();
      this.accumulators.set(sessionId, map);
    }
    return map;
  }

  private accumulateDelta(sessionId: string, event: Record<string, unknown>): void {
    const callId = event['call_id'];
    const delta = event['delta'];

    if (typeof callId !== 'string' || callId.trim() === '') {
      throw new OpenAiMalformedEventError(
        String(event['type']),
        'Missing "call_id" in function_call_arguments.delta.',
      );
    }
    if (typeof delta !== 'string') {
      throw new OpenAiMalformedEventError(
        String(event['type']),
        'Missing "delta" string in function_call_arguments.delta.',
      );
    }

    const map = this.getOrCreateSessionMap(sessionId);
    const existing = map.get(callId);
    if (existing) {
      existing.argumentsBuffer += delta;
    } else {
      map.set(callId, {
        callId,
        name: '', // name comes in the done event
        argumentsBuffer: delta,
      });
    }
  }

  private finalizeDone(
    sessionId: string,
    event: Record<string, unknown>,
  ): RealtimeToolCallEvent {
    const validated = validateToolCallDoneEvent(event);
    const { call_id, name, arguments: argStr } = validated;

    // Merge any accumulated delta buffer with the done arguments
    const map = this.accumulators.get(sessionId);
    const accumulated = map?.get(call_id);

    // The done event provides the final complete arguments string
    // (OpenAI guarantees this is the full JSON, not just the last delta)
    let finalArgs = argStr;
    if (accumulated && accumulated.argumentsBuffer && finalArgs === '') {
      finalArgs = accumulated.argumentsBuffer;
    }

    // Clean up accumulator
    map?.delete(call_id);

    const toolCall: RealtimeToolCall = {
      id: call_id,
      name,
      arguments: finalArgs,
    };

    return {
      toolCalls: [toolCall],
    };
  }

  /** Clear all accumulated state for a session (on session end/error). */
  public clearSession(sessionId: string): void {
    this.accumulators.delete(sessionId);
  }
}

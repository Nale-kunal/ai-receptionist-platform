/**
 * OpenAI Realtime Provider — Handler Tests
 *
 * Tests: TranscriptHandler, ToolHandler, InterruptionHandler, ResponseHandler
 */

import { OpenAiTranscriptHandler } from '../openai-realtime.transcript.handler';
import { OpenAiToolHandler } from '../openai-realtime.tool.handler';
import { OpenAiInterruptionHandler } from '../openai-realtime.interruption.handler';
import { OpenAiResponseHandler } from '../openai-realtime.response.handler';
import { OpenAiRealtimeSessionManager } from '../openai-realtime.session.manager';
import { OpenAiMalformedEventError } from '../openai-realtime.errors';

// ---------------------------------------------------------------------------
// Transcript Handler
// ---------------------------------------------------------------------------

describe('OpenAiTranscriptHandler', () => {
  let handler: OpenAiTranscriptHandler;

  beforeEach(() => {
    handler = new OpenAiTranscriptHandler();
  });

  it('normalizes user final transcript', () => {
    const result = handler.handle({
      type: 'conversation.item.input_audio_transcription.completed',
      transcript: 'I need to book an appointment.',
    });
    expect(result).toEqual({
      text: 'I need to book an appointment.',
      isFinal: true,
      speaker: 'user',
    });
  });

  it('normalizes assistant audio transcript delta', () => {
    const result = handler.handle({
      type: 'response.audio_transcript.delta',
      delta: 'Sure, let me',
    });
    expect(result).toEqual({
      text: 'Sure, let me',
      isFinal: false,
      speaker: 'assistant',
    });
  });

  it('normalizes assistant audio transcript done', () => {
    const result = handler.handle({
      type: 'response.audio_transcript.done',
      transcript: 'Sure, I can book that for you.',
    });
    expect(result).toEqual({
      text: 'Sure, I can book that for you.',
      isFinal: true,
      speaker: 'assistant',
    });
  });

  it('normalizes assistant text done event', () => {
    const result = handler.handle({
      type: 'response.text.done',
      text: 'Done.',
    });
    expect(result).toEqual({ text: 'Done.', isFinal: true, speaker: 'assistant' });
  });

  it('returns null for non-transcript events', () => {
    const result = handler.handle({ type: 'session.created' });
    expect(result).toBeNull();
  });

  it('throws for malformed user transcript (missing transcript field)', () => {
    expect(() =>
      handler.handle({
        type: 'conversation.item.input_audio_transcription.completed',
      }),
    ).toThrow(OpenAiMalformedEventError);
  });

  it('throws for malformed assistant delta (missing delta field)', () => {
    expect(() =>
      handler.handle({
        type: 'response.audio_transcript.delta',
      }),
    ).toThrow(OpenAiMalformedEventError);
  });
});

// ---------------------------------------------------------------------------
// Tool Handler
// ---------------------------------------------------------------------------

describe('OpenAiToolHandler', () => {
  let handler: OpenAiToolHandler;

  beforeEach(() => {
    handler = new OpenAiToolHandler();
  });

  it('returns null for argument delta events (streaming accumulation)', () => {
    const result = handler.handle('sess-1', {
      type: 'response.function_call_arguments.delta',
      call_id: 'call-123',
      delta: '{"date":',
    });
    expect(result).toBeNull();
  });

  it('emits a RealtimeToolCallEvent on done event', () => {
    handler.handle('sess-2', {
      type: 'response.function_call_arguments.delta',
      call_id: 'call-456',
      delta: '{"patientId":',
    });

    const result = handler.handle('sess-2', {
      type: 'response.function_call_arguments.done',
      call_id: 'call-456',
      name: 'book_appointment',
      arguments: '{"patientId":"p-1","date":"2024-01-15"}',
    });

    expect(result).not.toBeNull();
    expect(result!.toolCalls).toHaveLength(1);
    expect(result!.toolCalls[0]!.id).toBe('call-456');
    expect(result!.toolCalls[0]!.name).toBe('book_appointment');
    expect(result!.toolCalls[0]!.arguments).toBe('{"patientId":"p-1","date":"2024-01-15"}');
  });

  it('handles done event without prior delta', () => {
    const result = handler.handle('sess-3', {
      type: 'response.function_call_arguments.done',
      call_id: 'call-789',
      name: 'get_clinic_info',
      arguments: '{}',
    });
    expect(result).not.toBeNull();
    expect(result!.toolCalls[0]!.name).toBe('get_clinic_info');
  });

  it('returns null for non-tool events', () => {
    const result = handler.handle('sess-4', { type: 'session.created' });
    expect(result).toBeNull();
  });

  it('throws for malformed done event (missing call_id)', () => {
    expect(() =>
      handler.handle('sess-5', {
        type: 'response.function_call_arguments.done',
        name: 'test_tool',
        arguments: '{}',
      }),
    ).toThrow(OpenAiMalformedEventError);
  });

  it('clears accumulators on clearSession()', () => {
    handler.handle('sess-6', {
      type: 'response.function_call_arguments.delta',
      call_id: 'call-999',
      delta: '{"partial":',
    });
    handler.clearSession('sess-6');
    // After clearing, done event treats it as fresh
    const result = handler.handle('sess-6', {
      type: 'response.function_call_arguments.done',
      call_id: 'call-999',
      name: 'test',
      arguments: '{}',
    });
    expect(result!.toolCalls[0]!.arguments).toBe('{}');
  });
});

// ---------------------------------------------------------------------------
// Interruption Handler
// ---------------------------------------------------------------------------

describe('OpenAiInterruptionHandler', () => {
  let handler: OpenAiInterruptionHandler;

  beforeEach(() => {
    handler = new OpenAiInterruptionHandler();
  });

  it('normalizes speech_started as interruption', () => {
    const result = handler.handle({
      type: 'input_audio_buffer.speech_started',
      audio_start_ms: 1500,
      item_id: 'item-1',
    });
    expect(result).toEqual({
      interruptedAtMs: 1500,
      audioOffsetMs: 0,
    });
  });

  it('normalizes speech_stopped as interruption', () => {
    const result = handler.handle({
      type: 'input_audio_buffer.speech_stopped',
      audio_end_ms: 3200,
      item_id: 'item-2',
    });
    expect(result).toEqual({
      interruptedAtMs: 3200,
      audioOffsetMs: 0,
    });
  });

  it('returns null for non-interruption events', () => {
    expect(handler.handle({ type: 'session.created' })).toBeNull();
    expect(handler.handle({ type: 'response.done' })).toBeNull();
  });

  it('uses Date.now() when audio_start_ms is missing', () => {
    const before = Date.now();
    const result = handler.handle({
      type: 'input_audio_buffer.speech_started',
    });
    const after = Date.now();
    expect(result).not.toBeNull();
    expect(result!.interruptedAtMs).toBeGreaterThanOrEqual(before);
    expect(result!.interruptedAtMs).toBeLessThanOrEqual(after);
  });
});

// ---------------------------------------------------------------------------
// Response Handler (audio delta + usage)
// ---------------------------------------------------------------------------

describe('OpenAiResponseHandler', () => {
  let sessionManager: OpenAiRealtimeSessionManager;
  let handler: OpenAiResponseHandler;

  beforeEach(() => {
    sessionManager = new OpenAiRealtimeSessionManager();
    sessionManager.create('sess-resp');
    handler = new OpenAiResponseHandler(sessionManager);
  });

  it('decodes a response.audio.delta event to a RealtimeAudioFrame', () => {
    const audio = Buffer.from([0x01, 0x02, 0x03]).toString('base64');
    const frame = handler.handleAudioDelta('sess-resp', {
      type: 'response.audio.delta',
      delta: audio,
    });
    expect(frame).not.toBeNull();
    expect(frame!.payload).toEqual(Buffer.from([0x01, 0x02, 0x03]));
    expect(frame!.sequence).toBe(0); // First outbound sequence
    expect(frame!.codec).toBe('audio/pcm16');
  });

  it('returns null for non-audio-delta events', () => {
    const frame = handler.handleAudioDelta('sess-resp', {
      type: 'response.text.delta',
      delta: 'hello',
    });
    expect(frame).toBeNull();
  });

  it('throws for missing delta field', () => {
    const { OpenAiMalformedEventError: E } = jest.requireActual('../openai-realtime.errors');
    expect(() =>
      handler.handleAudioDelta('sess-resp', {
        type: 'response.audio.delta',
      }),
    ).toThrow();
  });

  it('extracts usage from response.done event', () => {
    const snapshot = handler.handleResponseDone('sess-resp', {
      type: 'response.done',
      response: {
        id: 'resp-1',
        status: 'completed',
        usage: {
          total_tokens: 150,
          input_tokens: 100,
          output_tokens: 50,
        },
      },
    });
    expect(snapshot).not.toBeNull();
    expect(snapshot!.inputTokens).toBe(100);
    expect(snapshot!.outputTokens).toBe(50);
    expect(snapshot!.totalTokens).toBe(150);

    // Token usage recorded in session manager
    const session = sessionManager.get('sess-resp');
    expect(session.inputTokensConsumed).toBe(100);
    expect(session.outputTokensConsumed).toBe(50);
  });

  it('returns null for response.done with no usage', () => {
    const snapshot = handler.handleResponseDone('sess-resp', {
      type: 'response.done',
      response: { id: 'resp-2', status: 'completed' },
    });
    expect(snapshot).toBeNull();
  });

  it('returns null for non-response.done events', () => {
    const snapshot = handler.handleResponseDone('sess-resp', {
      type: 'session.created',
    });
    expect(snapshot).toBeNull();
  });
});

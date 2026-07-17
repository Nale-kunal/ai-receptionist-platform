/**
 * OpenAI Realtime Provider — DTOs
 *
 * Data Transfer Objects for provider configuration and requests.
 * These are passed in from external callers and validated on entry.
 */

import type { OpenAiRealtimeModel, OpenAiVoice, OpenAiAudioFormat } from './openai-realtime.constants';

// ---------------------------------------------------------------------------
// Session Creation Config (passed via IRealtimeAiProvider.createSession)
// ---------------------------------------------------------------------------

/**
 * Configuration to initialize an OpenAI Realtime session.
 * The caller (Conversation Orchestrator) populates this from
 * the composed system prompt and tenant configuration.
 */
export interface OpenAiCreateSessionDto {
  /** The OpenAI model to use for this session */
  model?: OpenAiRealtimeModel;

  /** System prompt instructions for the AI */
  instructions?: string;

  /** Voice selection for TTS output */
  voice?: OpenAiVoice;

  /** Input audio encoding format */
  inputAudioFormat?: OpenAiAudioFormat;

  /** Output audio encoding format */
  outputAudioFormat?: OpenAiAudioFormat;

  /** Sampling temperature */
  temperature?: number;

  /** Maximum output tokens (or 'inf') */
  maxResponseOutputTokens?: number | 'inf';

  /** Tool definitions available for this session */
  tools?: Array<{
    type: 'function';
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
  }>;

  /** Turn detection configuration */
  turnDetection?: {
    type: 'server_vad' | 'none';
    threshold?: number;
    prefix_padding_ms?: number;
    silence_duration_ms?: number;
  } | null;
}

// ---------------------------------------------------------------------------
// Session Update Config (passed via IRealtimeAiProvider.updateSession)
// ---------------------------------------------------------------------------

export type OpenAiUpdateSessionDto = Partial<OpenAiCreateSessionDto>;

// ---------------------------------------------------------------------------
// Provider Connection Request
// ---------------------------------------------------------------------------

export interface OpenAiConnectRequestDto {
  /** The platform session ID (maps 1:1 to a WS connection) */
  sessionId: string;

  /** OpenAI API key — must be sourced from config, never from callers */
  apiKey: string;
}

// ---------------------------------------------------------------------------
// Audio Frame Send Request
// ---------------------------------------------------------------------------

export interface OpenAiAudioSendDto {
  sessionId: string;

  /**
   * Raw audio payload as Buffer.
   * Encoded to base64 before transmission to OpenAI.
   */
  payload: Buffer;

  codec: string;
  durationMs: number;
}

// ---------------------------------------------------------------------------
// Text Message Send Request
// ---------------------------------------------------------------------------

export interface OpenAiTextSendDto {
  sessionId: string;
  text: string;
  role: 'user' | 'assistant' | 'system';
}

/**
 * OpenAI Realtime Provider — Session Manager
 *
 * Manages the in-module registry of active OpenAI provider sessions.
 * Tracks per-session state: model, voice, instructions, tools, audio sequence.
 * This is provider-level state, separate from the platform's RealtimeSessionManager
 * (which tracks the database record).
 */

import { OpenAiSessionNotFoundError, OpenAiSessionAlreadyExistsError } from './openai-realtime.errors';
import type { OpenAiRealtimeModel, OpenAiVoice, OpenAiAudioFormat } from './openai-realtime.constants';
import { OPENAI_REALTIME_DEFAULT_MODEL, OPENAI_DEFAULT_VOICE, OPENAI_DEFAULT_AUDIO_FORMAT } from './openai-realtime.constants';

// ---------------------------------------------------------------------------
// Internal Session State
// ---------------------------------------------------------------------------

export interface OpenAiProviderSession {
  sessionId: string;
  model: OpenAiRealtimeModel;
  voice: OpenAiVoice;
  inputAudioFormat: OpenAiAudioFormat;
  outputAudioFormat: OpenAiAudioFormat;
  instructions: string;
  tools: Array<Record<string, unknown>>;
  temperature: number;
  maxResponseOutputTokens: number | 'inf';
  audioInboundSequence: number;
  audioOutboundSequence: number;
  createdAt: number;
  lastActivityAt: number;
  inputTokensConsumed: number;
  outputTokensConsumed: number;
}

// ---------------------------------------------------------------------------
// Session Manager
// ---------------------------------------------------------------------------

export class OpenAiRealtimeSessionManager {
  private readonly sessions = new Map<string, OpenAiProviderSession>();

  public create(
    sessionId: string,
    config: {
      model?: OpenAiRealtimeModel;
      voice?: OpenAiVoice;
      inputAudioFormat?: OpenAiAudioFormat;
      outputAudioFormat?: OpenAiAudioFormat;
      instructions?: string;
      tools?: Array<Record<string, unknown>>;
      temperature?: number;
      maxResponseOutputTokens?: number | 'inf';
    } = {},
  ): OpenAiProviderSession {
    if (this.sessions.has(sessionId)) {
      throw new OpenAiSessionAlreadyExistsError(sessionId);
    }

    const now = Date.now();
    const session: OpenAiProviderSession = {
      sessionId,
      model: config.model ?? OPENAI_REALTIME_DEFAULT_MODEL,
      voice: config.voice ?? OPENAI_DEFAULT_VOICE,
      inputAudioFormat: config.inputAudioFormat ?? OPENAI_DEFAULT_AUDIO_FORMAT,
      outputAudioFormat: config.outputAudioFormat ?? OPENAI_DEFAULT_AUDIO_FORMAT,
      instructions: config.instructions ?? '',
      tools: config.tools ?? [],
      temperature: config.temperature ?? 0.8,
      maxResponseOutputTokens: config.maxResponseOutputTokens ?? 'inf',
      audioInboundSequence: 0,
      audioOutboundSequence: 0,
      createdAt: now,
      lastActivityAt: now,
      inputTokensConsumed: 0,
      outputTokensConsumed: 0,
    };

    this.sessions.set(sessionId, session);
    return session;
  }

  public get(sessionId: string): OpenAiProviderSession {
    const session = this.sessions.get(sessionId);
    if (!session) throw new OpenAiSessionNotFoundError(sessionId);
    return session;
  }

  public update(
    sessionId: string,
    updates: Partial<Omit<OpenAiProviderSession, 'sessionId' | 'createdAt'>>,
  ): OpenAiProviderSession {
    const session = this.get(sessionId);
    Object.assign(session, updates, { lastActivityAt: Date.now() });
    return session;
  }

  public remove(sessionId: string): void {
    this.sessions.delete(sessionId);
  }

  public has(sessionId: string): boolean {
    return this.sessions.has(sessionId);
  }

  public recordTokenUsage(
    sessionId: string,
    inputTokens: number,
    outputTokens: number,
  ): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    session.inputTokensConsumed += inputTokens;
    session.outputTokensConsumed += outputTokens;
    session.lastActivityAt = Date.now();
  }

  public nextInboundSequence(sessionId: string): number {
    const session = this.get(sessionId);
    const seq = session.audioInboundSequence;
    session.audioInboundSequence = (seq + 1) % (2 ** 32);
    return seq;
  }

  public nextOutboundSequence(sessionId: string): number {
    const session = this.get(sessionId);
    const seq = session.audioOutboundSequence;
    session.audioOutboundSequence = (seq + 1) % (2 ** 32);
    return seq;
  }

  public listAll(): OpenAiProviderSession[] {
    return Array.from(this.sessions.values());
  }

  public activeCount(): number {
    return this.sessions.size;
  }
}

/**
 * OpenAI Realtime Provider — Configuration
 *
 * Loads and validates provider configuration from environment or
 * the platform's existing configuration system.
 */

import type { OpenAiRealtimeModel, OpenAiVoice, OpenAiAudioFormat } from './openai-realtime.constants';
import {
  OPENAI_REALTIME_DEFAULT_MODEL,
  OPENAI_DEFAULT_VOICE,
  OPENAI_DEFAULT_AUDIO_FORMAT,
  OPENAI_REALTIME_SUPPORTED_MODELS,
  OPENAI_WS_MAX_RECONNECT_ATTEMPTS,
  OPENAI_WS_HEARTBEAT_INTERVAL_MS,
  OPENAI_WS_IDLE_TIMEOUT_MS,
  OPENAI_WS_CONNECT_TIMEOUT_MS,
  OPENAI_CB_FAILURE_THRESHOLD,
  OPENAI_CB_SUCCESS_THRESHOLD,
  OPENAI_CB_HALF_OPEN_TIMEOUT_MS,
} from './openai-realtime.constants';

// ---------------------------------------------------------------------------
// Configuration Shape
// ---------------------------------------------------------------------------

export interface OpenAiRealtimeProviderConfig {
  /** Default model for sessions (can be overridden per-session) */
  defaultModel: OpenAiRealtimeModel;

  /** Default voice for TTS */
  defaultVoice: OpenAiVoice;

  /** Audio format for input and output */
  audioFormat: OpenAiAudioFormat;

  /** WebSocket lifecycle settings */
  ws: {
    connectTimeoutMs: number;
    heartbeatIntervalMs: number;
    idleTimeoutMs: number;
    maxReconnectAttempts: number;
  };

  /** Circuit breaker settings */
  circuitBreaker: {
    failureThreshold: number;
    successThreshold: number;
    halfOpenTimeoutMs: number;
  };

  /** Turn detection */
  turnDetection: {
    enabled: boolean;
    type: 'server_vad' | 'none';
    threshold: number;
    prefixPaddingMs: number;
    silenceDurationMs: number;
  };

  /** Token budget */
  maxResponseOutputTokens: number | 'inf';

  /** Sampling temperature */
  temperature: number;
}

// ---------------------------------------------------------------------------
// Configuration Loader
// ---------------------------------------------------------------------------

export function loadOpenAiRealtimeConfig(
  overrides?: Partial<OpenAiRealtimeProviderConfig>,
): OpenAiRealtimeProviderConfig {
  const model = (
    process.env['OPENAI_REALTIME_MODEL'] ?? OPENAI_REALTIME_DEFAULT_MODEL
  ) as OpenAiRealtimeModel;

  if (!OPENAI_REALTIME_SUPPORTED_MODELS.includes(model as OpenAiRealtimeModel)) {
    throw new Error(
      `Invalid OPENAI_REALTIME_MODEL: '${model}'. ` +
      `Supported models: ${OPENAI_REALTIME_SUPPORTED_MODELS.join(', ')}`,
    );
  }

  const baseConfig: OpenAiRealtimeProviderConfig = {
    defaultModel: model,
    defaultVoice: (process.env['OPENAI_REALTIME_VOICE'] ?? OPENAI_DEFAULT_VOICE) as OpenAiVoice,
    audioFormat: (process.env['OPENAI_REALTIME_AUDIO_FORMAT'] ?? OPENAI_DEFAULT_AUDIO_FORMAT) as OpenAiAudioFormat,
    ws: {
      connectTimeoutMs: parseInt(process.env['OPENAI_WS_CONNECT_TIMEOUT_MS'] ?? String(OPENAI_WS_CONNECT_TIMEOUT_MS), 10),
      heartbeatIntervalMs: parseInt(process.env['OPENAI_WS_HEARTBEAT_INTERVAL_MS'] ?? String(OPENAI_WS_HEARTBEAT_INTERVAL_MS), 10),
      idleTimeoutMs: parseInt(process.env['OPENAI_WS_IDLE_TIMEOUT_MS'] ?? String(OPENAI_WS_IDLE_TIMEOUT_MS), 10),
      maxReconnectAttempts: parseInt(process.env['OPENAI_WS_MAX_RECONNECT_ATTEMPTS'] ?? String(OPENAI_WS_MAX_RECONNECT_ATTEMPTS), 10),
    },
    circuitBreaker: {
      failureThreshold: parseInt(process.env['OPENAI_CB_FAILURE_THRESHOLD'] ?? String(OPENAI_CB_FAILURE_THRESHOLD), 10),
      successThreshold: parseInt(process.env['OPENAI_CB_SUCCESS_THRESHOLD'] ?? String(OPENAI_CB_SUCCESS_THRESHOLD), 10),
      halfOpenTimeoutMs: parseInt(process.env['OPENAI_CB_HALF_OPEN_TIMEOUT_MS'] ?? String(OPENAI_CB_HALF_OPEN_TIMEOUT_MS), 10),
    },
    turnDetection: {
      enabled: (process.env['OPENAI_TURN_DETECTION_ENABLED'] ?? 'true') === 'true',
      type: (process.env['OPENAI_TURN_DETECTION_TYPE'] ?? 'server_vad') as 'server_vad' | 'none',
      threshold: parseFloat(process.env['OPENAI_TURN_DETECTION_THRESHOLD'] ?? '0.5'),
      prefixPaddingMs: parseInt(process.env['OPENAI_TURN_DETECTION_PREFIX_PADDING_MS'] ?? '300', 10),
      silenceDurationMs: parseInt(process.env['OPENAI_TURN_DETECTION_SILENCE_DURATION_MS'] ?? '500', 10),
    },
    maxResponseOutputTokens: 'inf',
    temperature: parseFloat(process.env['OPENAI_REALTIME_TEMPERATURE'] ?? '0.8'),
  };

  return { ...baseConfig, ...overrides };
}

// ---------------------------------------------------------------------------
// Config Validator (for early failure)
// ---------------------------------------------------------------------------

export function validateOpenAiRealtimeConfig(config: OpenAiRealtimeProviderConfig): void {
  if (config.ws.connectTimeoutMs < 1000 || config.ws.connectTimeoutMs > 60_000) {
    throw new Error('OPENAI_WS_CONNECT_TIMEOUT_MS must be between 1000ms and 60000ms.');
  }
  if (config.ws.heartbeatIntervalMs < 1000) {
    throw new Error('OPENAI_WS_HEARTBEAT_INTERVAL_MS must be >= 1000ms.');
  }
  if (config.circuitBreaker.failureThreshold < 1) {
    throw new Error('OPENAI_CB_FAILURE_THRESHOLD must be >= 1.');
  }
  if (config.temperature < 0 || config.temperature > 2) {
    throw new Error('OPENAI_REALTIME_TEMPERATURE must be between 0 and 2.');
  }
}

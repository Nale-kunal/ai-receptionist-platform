/**
 * OpenAI Realtime Provider — Validators
 *
 * Validates inbound and outbound messages at the protocol boundary.
 * Ensures malformed OpenAI events never corrupt internal state.
 */

import { OpenAiMalformedEventError, OpenAiAudioPayloadTooLargeError } from './openai-realtime.errors';
import { OPENAI_WS_PAYLOAD_MAX_BYTES } from './openai-realtime.constants';

// ---------------------------------------------------------------------------
// Base Event Validator
// ---------------------------------------------------------------------------

/**
 * Validates that a raw WebSocket message looks like a parseable OpenAI event.
 */
export function validateRawEvent(raw: unknown): asserts raw is Record<string, unknown> {
  if (typeof raw !== 'object' || raw === null) {
    throw new OpenAiMalformedEventError(undefined, 'Event must be a non-null object.');
  }
  const obj = raw as Record<string, unknown>;
  if (typeof obj['type'] !== 'string' || obj['type'].trim() === '') {
    throw new OpenAiMalformedEventError(undefined, 'Event must have a non-empty string "type" field.');
  }
}

// ---------------------------------------------------------------------------
// Audio Payload Validator
// ---------------------------------------------------------------------------

/**
 * Validates a base64-encoded audio payload.
 * - Must be a non-empty string
 * - Decoded size must not exceed the payload limit
 */
export function validateAudioPayload(base64Audio: string): void {
  if (typeof base64Audio !== 'string' || base64Audio.length === 0) {
    throw new OpenAiMalformedEventError('audio', 'Audio payload must be a non-empty base64 string.');
  }

  // Decoded byte size (accounting for base64 padding '=' or '==')
  let padding = 0;
  if (base64Audio.endsWith('==')) {
    padding = 2;
  } else if (base64Audio.endsWith('=')) {
    padding = 1;
  }
  const decodedBytes = (base64Audio.length * 3) / 4 - padding;
  if (decodedBytes > OPENAI_WS_PAYLOAD_MAX_BYTES) {
    throw new OpenAiAudioPayloadTooLargeError(decodedBytes, OPENAI_WS_PAYLOAD_MAX_BYTES);
  }
}

// ---------------------------------------------------------------------------
// Session Config Validator
// ---------------------------------------------------------------------------

/**
 * Validates the session configuration object passed to createSession().
 * Returns a typed, sanitized session config.
 */
export function validateSessionConfig(config: Record<string, unknown>): {
  model?: string;
  voice?: string;
  instructions?: string;
  tools?: unknown[];
  temperature?: number;
} {
  const sanitized: Record<string, unknown> = {};

  if (config['model'] !== undefined) {
    if (typeof config['model'] !== 'string') {
      throw new OpenAiMalformedEventError('session.update', '"model" must be a string.');
    }
    sanitized['model'] = config['model'];
  }

  if (config['voice'] !== undefined) {
    if (typeof config['voice'] !== 'string') {
      throw new OpenAiMalformedEventError('session.update', '"voice" must be a string.');
    }
    sanitized['voice'] = config['voice'];
  }

  if (config['instructions'] !== undefined) {
    if (typeof config['instructions'] !== 'string') {
      throw new OpenAiMalformedEventError('session.update', '"instructions" must be a string.');
    }
    sanitized['instructions'] = config['instructions'];
  }

  if (config['tools'] !== undefined) {
    if (!Array.isArray(config['tools'])) {
      throw new OpenAiMalformedEventError('session.update', '"tools" must be an array.');
    }
    sanitized['tools'] = config['tools'];
  }

  if (config['temperature'] !== undefined) {
    const temp = config['temperature'];
    if (typeof temp !== 'number' || temp < 0 || temp > 2) {
      throw new OpenAiMalformedEventError('session.update', '"temperature" must be a number between 0 and 2.');
    }
    sanitized['temperature'] = temp;
  }

  return sanitized as ReturnType<typeof validateSessionConfig>;
}

// ---------------------------------------------------------------------------
// Tool Call Event Validator
// ---------------------------------------------------------------------------

/**
 * Validates a function_call_arguments.done event has required fields.
 */
export function validateToolCallDoneEvent(event: Record<string, unknown>): {
  call_id: string;
  name: string;
  arguments: string;
} {
  const callId = event['call_id'];
  const name = event['name'];
  const args = event['arguments'];

  if (typeof callId !== 'string' || callId.trim() === '') {
    throw new OpenAiMalformedEventError(
      String(event['type']),
      'Tool call event missing required "call_id" field.',
    );
  }
  if (typeof name !== 'string' || name.trim() === '') {
    throw new OpenAiMalformedEventError(
      String(event['type']),
      'Tool call event missing required "name" field.',
    );
  }
  if (typeof args !== 'string') {
    throw new OpenAiMalformedEventError(
      String(event['type']),
      'Tool call event "arguments" must be a JSON string.',
    );
  }

  return { call_id: callId, name, arguments: args };
}

// ---------------------------------------------------------------------------
// API Key Redactor (for safe logging)
// ---------------------------------------------------------------------------

/**
 * Redacts an API key for safe logging. Shows only the first 7 characters.
 */
export function redactApiKey(apiKey: string): string {
  if (!apiKey || apiKey.length <= 7) return '[REDACTED]';
  return `${apiKey.slice(0, 7)}...[REDACTED]`;
}

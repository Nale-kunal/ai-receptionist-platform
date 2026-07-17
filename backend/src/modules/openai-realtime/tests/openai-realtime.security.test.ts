/**
 * OpenAI Realtime Provider — Security Tests
 *
 * Tests: API key redaction, payload size enforcement,
 * PHI redaction in audit logs, malformed event rejection.
 */

import { validateRawEvent, validateAudioPayload, validateSessionConfig, redactApiKey } from '../openai-realtime.validators';
import { OpenAiMalformedEventError, OpenAiAudioPayloadTooLargeError } from '../openai-realtime.errors';
import { OpenAiRealtimeAuditLogger } from '../openai-realtime.audit.logger';

// ---------------------------------------------------------------------------
// Validator Security Tests
// ---------------------------------------------------------------------------

describe('Security: validateRawEvent()', () => {
  it('accepts valid event objects', () => {
    expect(() => validateRawEvent({ type: 'session.created' })).not.toThrow();
    expect(() => validateRawEvent({ type: 'response.audio.delta', delta: 'abc' })).not.toThrow();
  });

  it('rejects null', () => {
    expect(() => validateRawEvent(null)).toThrow(OpenAiMalformedEventError);
  });

  it('rejects non-objects', () => {
    expect(() => validateRawEvent('string')).toThrow(OpenAiMalformedEventError);
    expect(() => validateRawEvent(42)).toThrow(OpenAiMalformedEventError);
    expect(() => validateRawEvent([])).toThrow(OpenAiMalformedEventError);
  });

  it('rejects objects missing type field', () => {
    expect(() => validateRawEvent({ data: 'hello' })).toThrow(OpenAiMalformedEventError);
  });

  it('rejects objects with empty type field', () => {
    expect(() => validateRawEvent({ type: '   ' })).toThrow(OpenAiMalformedEventError);
  });

  it('rejects objects with non-string type field', () => {
    expect(() => validateRawEvent({ type: 42 })).toThrow(OpenAiMalformedEventError);
  });
});

// ---------------------------------------------------------------------------
// Audio Payload Size Validation
// ---------------------------------------------------------------------------

describe('Security: validateAudioPayload()', () => {
  it('accepts valid base64 audio payloads', () => {
    const smallPayload = Buffer.alloc(100).toString('base64');
    expect(() => validateAudioPayload(smallPayload)).not.toThrow();
  });

  it('rejects empty string', () => {
    expect(() => validateAudioPayload('')).toThrow(OpenAiMalformedEventError);
  });

  it('rejects non-string payloads', () => {
    expect(() => validateAudioPayload(null as unknown as string)).toThrow(OpenAiMalformedEventError);
  });

  it('rejects payloads exceeding 128KB limit', () => {
    // 128KB + 1 byte → exceeds limit
    const bigPayload = Buffer.alloc(131_073, 0xff).toString('base64');
    expect(() => validateAudioPayload(bigPayload)).toThrow(OpenAiAudioPayloadTooLargeError);
  });

  it('accepts exactly 128KB payloads', () => {
    const exactPayload = Buffer.alloc(131_072, 0x01).toString('base64');
    expect(() => validateAudioPayload(exactPayload)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Session Config Validation
// ---------------------------------------------------------------------------

describe('Security: validateSessionConfig()', () => {
  it('accepts valid session config', () => {
    const result = validateSessionConfig({
      model: 'gpt-4o-realtime-preview',
      voice: 'alloy',
      instructions: 'You are a receptionist.',
      tools: [],
      temperature: 0.8,
    });
    expect(result.model).toBe('gpt-4o-realtime-preview');
    expect(result.voice).toBe('alloy');
    expect(result.temperature).toBe(0.8);
  });

  it('accepts empty config', () => {
    expect(() => validateSessionConfig({})).not.toThrow();
  });

  it('rejects non-string model', () => {
    expect(() => validateSessionConfig({ model: 42 })).toThrow(OpenAiMalformedEventError);
  });

  it('rejects non-string instructions', () => {
    expect(() => validateSessionConfig({ instructions: { nested: 'obj' } })).toThrow(OpenAiMalformedEventError);
  });

  it('rejects non-array tools', () => {
    expect(() => validateSessionConfig({ tools: 'not-an-array' })).toThrow(OpenAiMalformedEventError);
  });

  it('rejects out-of-range temperature', () => {
    expect(() => validateSessionConfig({ temperature: 3 })).toThrow(OpenAiMalformedEventError);
    expect(() => validateSessionConfig({ temperature: -1 })).toThrow(OpenAiMalformedEventError);
  });

  it('accepts boundary temperature values', () => {
    expect(() => validateSessionConfig({ temperature: 0 })).not.toThrow();
    expect(() => validateSessionConfig({ temperature: 2 })).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// API Key Redaction
// ---------------------------------------------------------------------------

describe('Security: redactApiKey()', () => {
  it('redacts most of the key, keeps first 7 chars', () => {
    const redacted = redactApiKey('sk-proj-AbCdEfGhIjKlMnOpQr');
    expect(redacted).toBe('sk-proj...[REDACTED]');
    expect(redacted).not.toContain('AbCdEfGhIjKlMnOpQr');
  });

  it('fully redacts short keys', () => {
    expect(redactApiKey('short')).toBe('[REDACTED]');
    expect(redactApiKey('')).toBe('[REDACTED]');
  });

  it('handles exactly 7-char keys', () => {
    expect(redactApiKey('1234567')).toBe('[REDACTED]');
  });
});

// ---------------------------------------------------------------------------
// PHI Redaction in Audit Logger
// ---------------------------------------------------------------------------

describe('Security: OpenAiRealtimeAuditLogger PHI redaction', () => {
  it('redacts SSN patterns from error messages', async () => {
    const entries: unknown[] = [];
    const logger = new OpenAiRealtimeAuditLogger((entry) => entries.push(entry as unknown));

    await logger.logApiError(
      'sess-phi',
      'invalid_request',
      'Patient SSN is 123-45-6789, please verify.',
    );

    const entry = entries[0] as Record<string, unknown>;
    const data = entry['data'] as Record<string, unknown>;
    expect(String(data['message'])).not.toContain('123-45-6789');
    expect(String(data['message'])).toContain('[SSN_REDACTED]');
  });

  it('redacts OpenAI API keys from error messages', async () => {
    const entries: unknown[] = [];
    const logger = new OpenAiRealtimeAuditLogger((entry) => entries.push(entry as unknown));

    await logger.logApiError(
      'sess-key',
      'auth_error',
      'Invalid key sk-abcdefghijklmnopqrstuvwxyz1234567890',
    );

    const data = ((entries[0] as Record<string, unknown>)['data']) as Record<string, unknown>;
    expect(String(data['message'])).not.toContain('sk-abcde');
    expect(String(data['message'])).toContain('[API_KEY_REDACTED]');
  });

  it('does not include raw session audio in audit entries', async () => {
    const entries: unknown[] = [];
    const logger = new OpenAiRealtimeAuditLogger((entry) => entries.push(entry as unknown));

    await logger.logConnectionEstablished('sess-established', 'gpt-4o-realtime-preview');

    // Connection log should not include any audio data
    const entry = entries[0] as Record<string, unknown>;
    expect(JSON.stringify(entry)).not.toContain('audio');
    expect(JSON.stringify(entry)).not.toContain('base64');
    expect(JSON.stringify(entry)).not.toContain('payload');
  });

  it('includes correct event type and sessionId', async () => {
    const entries: unknown[] = [];
    const logger = new OpenAiRealtimeAuditLogger((entry) => entries.push(entry as unknown));

    await logger.logToolCallReceived('sess-tool', 'call-abc', 'book_appointment');

    const e0 = entries[0] as Record<string, unknown>;
    expect(e0['event']).toBe('openai.tool_call.received');
    expect(e0['sessionId']).toBe('sess-tool');
    const data = e0['data'] as Record<string, unknown>;
    expect(data['toolName']).toBe('book_appointment');
    expect(data['callId']).toBe('call-abc');
  });
});

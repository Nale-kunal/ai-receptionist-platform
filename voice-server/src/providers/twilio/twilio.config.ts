/**
 * Twilio Voice Provider — Configuration
 */

import { TWILIO_SAMPLE_RATE_8000 } from './twilio.constants';

export interface TwilioProviderConfig {
  accountSid: string;
  authToken: string;
  apiKey?: string;
  apiSecret?: string;
  webhookUrl: string;
  mediaStreamUrl: string;
  sampleRate: number;
  codec: string;
  maxCallDurationSeconds: number;
  heartbeatIntervalMs: number;
  reconnectAttempts: number;
  silenceThresholdDb: number;
  silenceDurationMs: number;
}

export function loadTwilioConfig(overrides?: Partial<TwilioProviderConfig>): TwilioProviderConfig {
  return {
    accountSid: process.env['TWILIO_ACCOUNT_SID']!,
    authToken: process.env['TWILIO_AUTH_TOKEN']!,
    apiKey: process.env['TWILIO_API_KEY'],
    apiSecret: process.env['TWILIO_API_SECRET'],
    webhookUrl: process.env['TWILIO_WEBHOOK_URL'] ?? 'https://localhost/webhooks/voice',
    mediaStreamUrl: process.env['TWILIO_MEDIA_STREAM_URL'] ?? 'wss://localhost/webhooks/voice/stream',
    sampleRate: parseInt(process.env['TWILIO_SAMPLE_RATE'] ?? String(TWILIO_SAMPLE_RATE_8000), 10),
    codec: process.env['TWILIO_CODEC'] ?? 'audio/PCMU',
    maxCallDurationSeconds: parseInt(process.env['TWILIO_MAX_CALL_DURATION'] ?? '3600', 10),
    heartbeatIntervalMs: parseInt(process.env['TWILIO_HEARTBEAT_INTERVAL'] ?? '10000', 10),
    reconnectAttempts: parseInt(process.env['TWILIO_RECONNECT_ATTEMPTS'] ?? '5', 10),
    silenceThresholdDb: parseFloat(process.env['TWILIO_SILENCE_THRESHOLD_DB'] ?? '-45'),
    silenceDurationMs: parseInt(process.env['TWILIO_SILENCE_DURATION_MS'] ?? '2000', 10),
    ...overrides,
  };
}

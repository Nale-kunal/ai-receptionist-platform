/**
 * Twilio Voice Provider — Validators
 */

import { PayloadValidationFailure } from './twilio.errors';

export function validateWebhookPayload(body: unknown): asserts body is Record<string, string> {
  if (typeof body !== 'object' || body === null) {
    throw new PayloadValidationFailure('Webhook payload must be a non-null object.');
  }

  const obj = body as Record<string, unknown>;

  // CallSid is Twilio's standard unique identifier for call sessions
  if (typeof obj['CallSid'] !== 'string' || obj['CallSid'].trim() === '') {
    throw new PayloadValidationFailure('Webhook payload missing required string field "CallSid".');
  }

  if (typeof obj['AccountSid'] !== 'string' || obj['AccountSid'].trim() === '') {
    throw new PayloadValidationFailure('Webhook payload missing required string field "AccountSid".');
  }
}

export function validateMediaStreamPayload(payload: unknown): asserts payload is Record<string, unknown> {
  if (typeof payload !== 'object' || payload === null) {
    throw new PayloadValidationFailure('Media Stream WebSocket frame must be a valid JSON object.');
  }

  const obj = payload as Record<string, unknown>;
  if (typeof obj['event'] !== 'string' || obj['event'].trim() === '') {
    throw new PayloadValidationFailure('Media Stream event field must be a non-empty string.');
  }
}

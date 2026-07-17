/**
 * Twilio Voice Provider — Webhook Security Validator
 *
 * Implements signature checking, request URL matching, body integrity,
 * replay protection windows, and size limits.
 */

import * as crypto from 'crypto';
import type { ITwilioSecurityValidator } from './twilio.interfaces';
import { WebhookValidationFailure, ReplayAttackDetected, PayloadValidationFailure } from './twilio.errors';
import {
  TWILIO_TIMESTAMP_SKEW_WINDOW_MS,
  TWILIO_REPLAY_CACHE_EXPIRY_MS,
  TWILIO_WS_PAYLOAD_MAX_BYTES,
} from './twilio.constants';

export class TwilioSecurityValidator implements ITwilioSecurityValidator {
  private readonly replayCache = new Map<string, number>(); // signature -> timestamp received
  private readonly authToken: string;

  constructor(authToken: string) {
    this.authToken = authToken;
    this.startCleanupInterval();
  }

  public validateSignature(url: string, params: Record<string, string>, signature: string): boolean {
    if (!signature) {
      throw new WebhookValidationFailure('Missing "X-Twilio-Signature" header.');
    }

    // Twilio signature calculation:
    // 1. Sort parameter keys alphabetically
    const keys = Object.keys(params).sort();
    // 2. Concatenate key + value to the end of the URL
    let dataStr = url;
    for (const key of keys) {
      dataStr += `${key}${params[key] ?? ''}`;
    }

    // 3. Compute HMAC-SHA1 of concatenation using auth token
    const calculated = crypto
      .createHmac('sha1', this.authToken)
      .update(dataStr, 'utf-8')
      .digest('base64');

    if (calculated !== signature) {
      throw new WebhookValidationFailure('Calculated signature does not match header value.');
    }

    return true;
  }

  public validateTimestamp(timestampStr: string): boolean {
    const timestamp = parseInt(timestampStr, 10);
    if (isNaN(timestamp)) {
      throw new WebhookValidationFailure('Invalid request timestamp value.');
    }

    const now = Date.now();
    const skew = Math.abs(now - timestamp);
    if (skew > TWILIO_TIMESTAMP_SKEW_WINDOW_MS) {
      throw new WebhookValidationFailure('Request timestamp falls outside allowed clock skew window.');
    }

    return true;
  }

  public checkReplay(signature: string): boolean {
    const now = Date.now();
    const lastSeen = this.replayCache.get(signature);
    if (lastSeen !== undefined) {
      // Replay attack! Same signature received twice
      throw new ReplayAttackDetected(signature);
    }

    this.replayCache.set(signature, now);
    return true;
  }

  public validateFrameSize(bytes: number): void {
    if (bytes <= 0) {
      throw new PayloadValidationFailure('Frame size cannot be zero or negative.');
    }
    if (bytes > TWILIO_WS_PAYLOAD_MAX_BYTES) {
      throw new PayloadValidationFailure(`Frame size of ${bytes} bytes exceeds the maximum allowed ${TWILIO_WS_PAYLOAD_MAX_BYTES} limit.`);
    }
  }

  // Periodic memory cleanup for the sliding replay prevention cache
  private startCleanupInterval(): void {
    setInterval(() => {
      const now = Date.now();
      for (const [sig, timestamp] of this.replayCache.entries()) {
        if (now - timestamp > TWILIO_REPLAY_CACHE_EXPIRY_MS) {
          this.replayCache.delete(sig);
        }
      }
    }, TWILIO_REPLAY_CACHE_EXPIRY_MS).unref();
  }
}

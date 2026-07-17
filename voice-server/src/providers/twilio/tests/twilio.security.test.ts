/**
 * Twilio Voice Provider — Webhook Security Tests
 */

import { TwilioSecurityValidator } from '../twilio.security.validator';
import { TwilioAuditLogger } from '../twilio.audit.logger';
import {
  WebhookValidationFailure,
  ReplayAttackDetected,
  PayloadValidationFailure,
} from '../twilio.errors';

describe('Twilio Webhook Security Validation', () => {
  const authToken = 'mock_auth_token_for_validation_123';
  let validator: TwilioSecurityValidator;

  beforeEach(() => {
    validator = new TwilioSecurityValidator(authToken);
  });

  // ---------------------------------------------------------------------------
  // Signature Validation
  // ---------------------------------------------------------------------------

  it('passes validation for valid signature matching params', () => {
    const url = 'https://localhost/webhooks/voice/inbound';
    const params = {
      CallSid: 'CA123456789',
      From: '+1234567890',
    };
    
    // Compute expected signature: URL + CallSidCA123456789From+1234567890
    const crypto = require('crypto');
    const dataStr = url + 'CallSidCA123456789From+1234567890';
    const signature = crypto
      .createHmac('sha1', authToken)
      .update(dataStr, 'utf-8')
      .digest('base64');

    expect(validator.validateSignature(url, params, signature)).toBe(true);
  });

  it('throws WebhookValidationFailure for missing signature', () => {
    expect(() => validator.validateSignature('https://test.com', {}, ''))
      .toThrow(WebhookValidationFailure);
  });

  it('throws WebhookValidationFailure for incorrect signature mismatch', () => {
    expect(() => validator.validateSignature('https://test.com', {}, 'invalidsig'))
      .toThrow(WebhookValidationFailure);
  });

  // ---------------------------------------------------------------------------
  // Timestamp skew validation
  // ---------------------------------------------------------------------------

  it('passes timestamp validation within clock skew window', () => {
    const timestampStr = String(Date.now() - 1000);
    expect(validator.validateTimestamp(timestampStr)).toBe(true);
  });

  it('throws WebhookValidationFailure for skewed timestamp exceeding limit', () => {
    const timestampStr = String(Date.now() - 360000); // 6 mins ago (max is 5)
    expect(() => validator.validateTimestamp(timestampStr)).toThrow(WebhookValidationFailure);
  });

  it('throws WebhookValidationFailure for non-numeric timestamp value', () => {
    expect(() => validator.validateTimestamp('abc')).toThrow(WebhookValidationFailure);
  });

  // ---------------------------------------------------------------------------
  // Replay Attack protection
  // ---------------------------------------------------------------------------

  it('blocks second request with duplicate signature in window', () => {
    const signature = 'unique_sig_abc_123';
    expect(validator.checkReplay(signature)).toBe(true);
    expect(() => validator.checkReplay(signature)).toThrow(ReplayAttackDetected);
  });

  // ---------------------------------------------------------------------------
  // Audit logger masking
  // ---------------------------------------------------------------------------

  it('correctly masks caller and callee numbers', () => {
    const logger = new TwilioAuditLogger(() => {});
    expect(logger.maskPhoneNumber('+1234567890')).toBe('+12*****90');
    expect(logger.maskPhoneNumber('123')).toBe('*****');
    expect(logger.maskPhoneNumber('')).toBe('[EMPTY]');
  });
});

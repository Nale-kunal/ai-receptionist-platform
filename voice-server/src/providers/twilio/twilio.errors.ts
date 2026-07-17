/**
 * Twilio Voice Provider — Error Hierarchy
 */

import { VoiceServerError } from '../../errors/voice-server.errors';

export class TwilioProviderError extends VoiceServerError {
  constructor(message: string, code: string, statusCode = 400, details?: Record<string, unknown>) {
    super(message, code, statusCode, details);
  }
}

export class WebhookValidationFailure extends TwilioProviderError {
  constructor(reason: string) {
    super(`Twilio webhook signature verification failed: ${reason}`, 'WEBHOOK_VALIDATION_FAILURE', 401, { reason });
  }
}

export class MediaStreamFailure extends TwilioProviderError {
  constructor(reason: string) {
    super(`Media stream protocol processing error: ${reason}`, 'MEDIA_STREAM_FAILURE', 400, { reason });
  }
}

export class CallLifecycleFailure extends TwilioProviderError {
  constructor(reason: string) {
    super(`Call lifecycle state machine violation: ${reason}`, 'CALL_LIFECYCLE_FAILURE', 422, { reason });
  }
}

export class ConnectionFailure extends TwilioProviderError {
  constructor(reason: string) {
    super(`Twilio socket or HTTP connection error: ${reason}`, 'CONNECTION_FAILURE', 503, { reason });
  }
}

export class AuthenticationFailure extends TwilioProviderError {
  constructor(reason: string) {
    super(`Twilio security credentials authentication failure: ${reason}`, 'AUTHENTICATION_FAILURE', 401, { reason });
  }
}

export class PayloadValidationFailure extends TwilioProviderError {
  constructor(reason: string) {
    super(`Malformed payload or invalid payload schema: ${reason}`, 'PAYLOAD_VALIDATION_FAILURE', 400, { reason });
  }
}

export class ReplayAttackDetected extends TwilioProviderError {
  constructor(signature: string) {
    super(`Potential replay attack detected for signature '${signature}'`, 'REPLAY_ATTACK_DETECTED', 403, { signature });
  }
}

export class StreamingFailure extends TwilioProviderError {
  constructor(reason: string) {
    super(`Audio encoding/decoding or packet buffer failure: ${reason}`, 'STREAMING_FAILURE', 500, { reason });
  }
}

export class TimeoutFailure extends TwilioProviderError {
  constructor(reason: string) {
    super(`Telephony connection keepalive heartbeat timed out: ${reason}`, 'TIMEOUT_FAILURE', 408, { reason });
  }
}

export class ProviderFailure extends TwilioProviderError {
  constructor(reason: string) {
    super(`Internal provider outage or error callback: ${reason}`, 'PROVIDER_FAILURE', 502, { reason });
  }
}

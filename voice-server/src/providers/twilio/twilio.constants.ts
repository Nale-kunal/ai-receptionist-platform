/**
 * Twilio Voice Provider — Constants
 */

export const TWILIO_PROVIDER_NAME = 'twilio' as const;

// Default codec configuration (Twilio standard)
export const TWILIO_CODEC_MULAW = 'audio/x-mulaw' as const;
export const TWILIO_SAMPLE_RATE_8000 = 8000;
export const TWILIO_FRAME_SIZE_BYTES = 160; // 20ms of 8kHz 8-bit PCMU/mulaw is 160 bytes
export const TWILIO_FRAME_DURATION_MS = 20;

// Webhook HTTP routes
export const TWILIO_ROUTE_INBOUND = '/webhooks/voice/inbound' as const;
export const TWILIO_ROUTE_STATUS = '/webhooks/voice/status' as const;

// Signature header
export const TWILIO_SIGNATURE_HEADER = 'x-twilio-signature' as const;

// Call States matching internal and Twilio callbacks
export const TWILIO_CALL_STATE_CREATED      = 'CREATED'      as const;
export const TWILIO_CALL_STATE_RINGING      = 'RINGING'      as const;
export const TWILIO_CALL_STATE_ANSWERED     = 'ANSWERED'     as const;
export const TWILIO_CALL_STATE_STREAMING    = 'STREAMING'    as const;
export const TWILIO_CALL_STATE_ON_HOLD      = 'ON_HOLD'      as const;
export const TWILIO_CALL_STATE_RESUMED      = 'RESUMED'      as const;
export const TWILIO_CALL_STATE_TRANSFERRING = 'TRANSFERRING' as const;
export const TWILIO_CALL_STATE_ENDING       = 'ENDING'       as const;
export const TWILIO_CALL_STATE_ENDED        = 'ENDED'        as const;
export const TWILIO_CALL_STATE_FAILED       = 'FAILED'       as const;

export const TWILIO_SUPPORTED_CALL_STATES = [
  TWILIO_CALL_STATE_CREATED,
  TWILIO_CALL_STATE_RINGING,
  TWILIO_CALL_STATE_ANSWERED,
  TWILIO_CALL_STATE_STREAMING,
  TWILIO_CALL_STATE_ON_HOLD,
  TWILIO_CALL_STATE_RESUMED,
  TWILIO_CALL_STATE_TRANSFERRING,
  TWILIO_CALL_STATE_ENDING,
  TWILIO_CALL_STATE_ENDED,
  TWILIO_CALL_STATE_FAILED,
] as const;

export type TwilioCallState = (typeof TWILIO_SUPPORTED_CALL_STATES)[number];

// WebSocket constants for media stream
export const TWILIO_WS_PAYLOAD_MAX_BYTES = 65536; // 64 KB
export const TWILIO_WS_HEARTBEAT_INTERVAL_MS = 10000;
export const TWILIO_WS_IDLE_TIMEOUT_MS = 60000;
export const TWILIO_WS_RECONNECT_ATTEMPTS = 5;

// Circuit Breaker constants
export const TWILIO_CB_FAILURE_THRESHOLD = 5;
export const TWILIO_CB_SUCCESS_THRESHOLD = 2;
export const TWILIO_CB_HALF_OPEN_TIMEOUT_MS = 15000;
export const TWILIO_TIMESTAMP_SKEW_WINDOW_MS = 300000; // 5 minutes
export const TWILIO_REPLAY_CACHE_EXPIRY_MS = 300000;

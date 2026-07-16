/**
 * Voice Server Infrastructure Configurations
 */

export interface VoiceServerConfig {
  /** Maximum duration of a voice session (in milliseconds) before automatic graceful cutoff. Default is 30 minutes. */
  maxSessionDurationMs: number;
  /** Keepalive heartbeat check interval (in milliseconds) */
  heartbeatIntervalMs: number;
  /** Maximum number of reconnect attempts before terminating the stream */
  maxReconnectAttempts: number;
  /** Delay (in milliseconds) between reconnection attempts */
  reconnectDelayMs: number;
  /** Default frame size (in milliseconds, e.g., 20ms chunks) */
  frameSizeMs: number;
  /** Default audio sample rate (in Hz) */
  sampleRateHz: number;
  /** Codec preferences list */
  codecPreferences: string[];
  /** Maximum allowed audio buffer length (in frames) under backpressure */
  maxBufferFrameCount: number;
  /** Jitter buffer size (in milliseconds) */
  jitterBufferMs: number;
  /** Maximum incoming message/payload size (in bytes) allowed over WS */
  maxPayloadSizeBytes: number;
  /** Idle timeout duration (in milliseconds) before a silent session is auto-closed */
  idleTimeoutMs: number;
  /** Rate-limiting: maximum voice sessions created per minute per tenant */
  rateLimitSessionsPerMinute: number;
}

export const DEFAULT_VOICE_SERVER_CONFIG: VoiceServerConfig = {
  maxSessionDurationMs: 30 * 60 * 1000, // 30 minutes
  heartbeatIntervalMs: 15 * 1000,       // 15 seconds
  maxReconnectAttempts: 5,
  reconnectDelayMs: 2000,                // 2 seconds
  frameSizeMs: 20,                       // 20ms frames
  sampleRateHz: 8000,                    // 8kHz standard telephony G.711 / PCMU
  codecPreferences: ['audio/PCMU', 'audio/PCMA', 'audio/L16'],
  maxBufferFrameCount: 150,              // 150 frames * 20ms = 3.0 seconds maximum queue size
  jitterBufferMs: 60,                    // 3 frames delay to absorb network jitter
  maxPayloadSizeBytes: 65536,            // 64 KB maximum frame size
  idleTimeoutMs: 60 * 1000,              // 1 minute of complete silence or disconnect
  rateLimitSessionsPerMinute: 20,
};

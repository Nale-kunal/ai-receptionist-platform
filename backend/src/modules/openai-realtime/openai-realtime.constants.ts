/**
 * OpenAI Realtime Provider — Constants
 *
 * All OpenAI-specific constants remain inside this module boundary.
 * Do NOT re-export from the module barrel.
 */

// ---------------------------------------------------------------------------
// OpenAI Realtime API Endpoint
// ---------------------------------------------------------------------------

export const OPENAI_REALTIME_API_BASE_URL =
  'wss://api.openai.com/v1/realtime' as const;

// ---------------------------------------------------------------------------
// OpenAI Realtime Models
// ---------------------------------------------------------------------------

export const OPENAI_REALTIME_MODEL_GPT4O_REALTIME     = 'gpt-4o-realtime-preview' as const;
export const OPENAI_REALTIME_MODEL_GPT4O_MINI_REALTIME = 'gpt-4o-mini-realtime-preview' as const;
export const OPENAI_REALTIME_DEFAULT_MODEL             = OPENAI_REALTIME_MODEL_GPT4O_REALTIME;

export const OPENAI_REALTIME_SUPPORTED_MODELS = [
  OPENAI_REALTIME_MODEL_GPT4O_REALTIME,
  OPENAI_REALTIME_MODEL_GPT4O_MINI_REALTIME,
] as const;

export type OpenAiRealtimeModel = (typeof OPENAI_REALTIME_SUPPORTED_MODELS)[number];

// ---------------------------------------------------------------------------
// OpenAI Realtime Audio Formats
// ---------------------------------------------------------------------------

export const OPENAI_AUDIO_FORMAT_PCM16 = 'pcm16' as const;
export const OPENAI_AUDIO_FORMAT_G711_ULAW = 'g711_ulaw' as const;
export const OPENAI_AUDIO_FORMAT_G711_ALAW = 'g711_alaw' as const;
export const OPENAI_DEFAULT_AUDIO_FORMAT   = OPENAI_AUDIO_FORMAT_PCM16;

export type OpenAiAudioFormat =
  | typeof OPENAI_AUDIO_FORMAT_PCM16
  | typeof OPENAI_AUDIO_FORMAT_G711_ULAW
  | typeof OPENAI_AUDIO_FORMAT_G711_ALAW;

// ---------------------------------------------------------------------------
// OpenAI Realtime Voice Options
// ---------------------------------------------------------------------------

export const OPENAI_VOICE_ALLOY   = 'alloy'   as const;
export const OPENAI_VOICE_ECHO    = 'echo'    as const;
export const OPENAI_VOICE_FABLE   = 'fable'   as const;
export const OPENAI_VOICE_ONYX    = 'onyx'    as const;
export const OPENAI_VOICE_NOVA    = 'nova'    as const;
export const OPENAI_VOICE_SHIMMER = 'shimmer' as const;
export const OPENAI_DEFAULT_VOICE = OPENAI_VOICE_ALLOY;

export type OpenAiVoice =
  | typeof OPENAI_VOICE_ALLOY
  | typeof OPENAI_VOICE_ECHO
  | typeof OPENAI_VOICE_FABLE
  | typeof OPENAI_VOICE_ONYX
  | typeof OPENAI_VOICE_NOVA
  | typeof OPENAI_VOICE_SHIMMER;

// ---------------------------------------------------------------------------
// OpenAI Realtime Server Events (inbound from OpenAI)
// ---------------------------------------------------------------------------

export const OPENAI_EVENT_SESSION_CREATED    = 'session.created'    as const;
export const OPENAI_EVENT_SESSION_UPDATED    = 'session.updated'    as const;
export const OPENAI_EVENT_ERROR              = 'error'              as const;
export const OPENAI_EVENT_RATE_LIMITS_UPDATED = 'rate_limits.updated' as const;

export const OPENAI_EVENT_INPUT_AUDIO_BUFFER_COMMITTED       = 'input_audio_buffer.committed'        as const;
export const OPENAI_EVENT_INPUT_AUDIO_BUFFER_CLEARED         = 'input_audio_buffer.cleared'          as const;
export const OPENAI_EVENT_INPUT_AUDIO_BUFFER_SPEECH_STARTED  = 'input_audio_buffer.speech_started'   as const;
export const OPENAI_EVENT_INPUT_AUDIO_BUFFER_SPEECH_STOPPED  = 'input_audio_buffer.speech_stopped'   as const;

export const OPENAI_EVENT_CONVERSATION_CREATED                             = 'conversation.created'                              as const;
export const OPENAI_EVENT_CONVERSATION_ITEM_CREATED                        = 'conversation.item.created'                         as const;
export const OPENAI_EVENT_CONVERSATION_ITEM_TRUNCATED                      = 'conversation.item.truncated'                       as const;
export const OPENAI_EVENT_CONVERSATION_ITEM_DELETED                        = 'conversation.item.deleted'                         as const;
export const OPENAI_EVENT_CONVERSATION_ITEM_INPUT_AUDIO_TRANSCRIPTION_COMPLETED = 'conversation.item.input_audio_transcription.completed' as const;
export const OPENAI_EVENT_CONVERSATION_ITEM_INPUT_AUDIO_TRANSCRIPTION_FAILED    = 'conversation.item.input_audio_transcription.failed'    as const;

export const OPENAI_EVENT_RESPONSE_CREATED           = 'response.created'            as const;
export const OPENAI_EVENT_RESPONSE_DONE              = 'response.done'               as const;
export const OPENAI_EVENT_RESPONSE_OUTPUT_ITEM_ADDED = 'response.output_item.added'  as const;
export const OPENAI_EVENT_RESPONSE_OUTPUT_ITEM_DONE  = 'response.output_item.done'   as const;
export const OPENAI_EVENT_RESPONSE_CONTENT_PART_ADDED = 'response.content_part.added' as const;
export const OPENAI_EVENT_RESPONSE_CONTENT_PART_DONE  = 'response.content_part.done'  as const;
export const OPENAI_EVENT_RESPONSE_TEXT_DELTA        = 'response.text.delta'          as const;
export const OPENAI_EVENT_RESPONSE_TEXT_DONE         = 'response.text.done'           as const;
export const OPENAI_EVENT_RESPONSE_AUDIO_TRANSCRIPT_DELTA = 'response.audio_transcript.delta' as const;
export const OPENAI_EVENT_RESPONSE_AUDIO_TRANSCRIPT_DONE  = 'response.audio_transcript.done'  as const;
export const OPENAI_EVENT_RESPONSE_AUDIO_DELTA       = 'response.audio.delta'         as const;
export const OPENAI_EVENT_RESPONSE_AUDIO_DONE        = 'response.audio.done'          as const;
export const OPENAI_EVENT_RESPONSE_FUNCTION_CALL_ARGUMENTS_DELTA = 'response.function_call_arguments.delta' as const;
export const OPENAI_EVENT_RESPONSE_FUNCTION_CALL_ARGUMENTS_DONE  = 'response.function_call_arguments.done'  as const;

// ---------------------------------------------------------------------------
// OpenAI Realtime Client Events (outbound to OpenAI)
// ---------------------------------------------------------------------------

export const OPENAI_CLIENT_EVENT_SESSION_UPDATE          = 'session.update'                 as const;
export const OPENAI_CLIENT_EVENT_INPUT_AUDIO_BUFFER_APPEND  = 'input_audio_buffer.append'  as const;
export const OPENAI_CLIENT_EVENT_INPUT_AUDIO_BUFFER_COMMIT  = 'input_audio_buffer.commit'  as const;
export const OPENAI_CLIENT_EVENT_INPUT_AUDIO_BUFFER_CLEAR   = 'input_audio_buffer.clear'   as const;
export const OPENAI_CLIENT_EVENT_CONVERSATION_ITEM_CREATE   = 'conversation.item.create'   as const;
export const OPENAI_CLIENT_EVENT_CONVERSATION_ITEM_TRUNCATE = 'conversation.item.truncate' as const;
export const OPENAI_CLIENT_EVENT_CONVERSATION_ITEM_DELETE   = 'conversation.item.delete'   as const;
export const OPENAI_CLIENT_EVENT_RESPONSE_CREATE            = 'response.create'            as const;
export const OPENAI_CLIENT_EVENT_RESPONSE_CANCEL            = 'response.cancel'            as const;

// ---------------------------------------------------------------------------
// WebSocket Lifecycle Configuration
// ---------------------------------------------------------------------------

export const OPENAI_WS_CONNECT_TIMEOUT_MS      = 10_000;  // 10 seconds
export const OPENAI_WS_HEARTBEAT_INTERVAL_MS   = 10_000;  // 10 seconds ping
export const OPENAI_WS_RECONNECT_BASE_DELAY_MS = 1_000;   // 1 second base backoff
export const OPENAI_WS_RECONNECT_MAX_DELAY_MS  = 30_000;  // 30 seconds max backoff
export const OPENAI_WS_MAX_RECONNECT_ATTEMPTS  = 5;
export const OPENAI_WS_IDLE_TIMEOUT_MS         = 60_000;  // 60 seconds
export const OPENAI_WS_PAYLOAD_MAX_BYTES       = 131_072; // 128 KB

// ---------------------------------------------------------------------------
// Circuit Breaker Thresholds
// ---------------------------------------------------------------------------

export const OPENAI_CB_FAILURE_THRESHOLD    = 5;      // Open after 5 consecutive failures
export const OPENAI_CB_SUCCESS_THRESHOLD    = 2;      // Close after 2 consecutive successes
export const OPENAI_CB_HALF_OPEN_TIMEOUT_MS = 15_000; // 15 seconds before trying again

// ---------------------------------------------------------------------------
// Audio Configuration Defaults
// ---------------------------------------------------------------------------

export const OPENAI_DEFAULT_SAMPLE_RATE_HZ = 24_000; // 24 kHz PCM16
export const OPENAI_AUDIO_CHUNK_DURATION_MS = 20;     // 20ms per frame
export const OPENAI_AUDIO_SEQUENCE_ROLLOVER = 2 ** 32; // uint32 max

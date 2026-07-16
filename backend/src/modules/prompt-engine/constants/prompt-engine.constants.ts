/**
 * Prompt Engine Constants
 */

// ---------------------------------------------------------------------------
// Prompt Types
// ---------------------------------------------------------------------------

export const PROMPT_TYPE_SYSTEM       = 'system'       as const;
export const PROMPT_TYPE_GREETING     = 'greeting'     as const;
export const PROMPT_TYPE_FALLBACK     = 'fallback'     as const;
export const PROMPT_TYPE_BOOKING      = 'booking'      as const;
export const PROMPT_TYPE_CANCELLATION = 'cancellation' as const;
export const PROMPT_TYPE_RESCHEDULING = 'rescheduling' as const;
export const PROMPT_TYPE_FAQ          = 'faq'          as const;
export const PROMPT_TYPE_AFTER_HOURS  = 'after_hours'  as const;
export const PROMPT_TYPE_EMERGENCY    = 'emergency'    as const;
export const PROMPT_TYPE_GOODBYE      = 'goodbye'      as const;

export const SUPPORTED_PROMPT_TYPES = [
  PROMPT_TYPE_SYSTEM,
  PROMPT_TYPE_GREETING,
  PROMPT_TYPE_FALLBACK,
  PROMPT_TYPE_BOOKING,
  PROMPT_TYPE_CANCELLATION,
  PROMPT_TYPE_RESCHEDULING,
  PROMPT_TYPE_FAQ,
  PROMPT_TYPE_AFTER_HOURS,
  PROMPT_TYPE_EMERGENCY,
  PROMPT_TYPE_GOODBYE,
] as const;

export type PromptType = (typeof SUPPORTED_PROMPT_TYPES)[number];

// ---------------------------------------------------------------------------
// Prompt Statuses
// ---------------------------------------------------------------------------

export const PROMPT_STATUS_DRAFT      = 'draft'       as const;
export const PROMPT_STATUS_PUBLISHED  = 'published'   as const;
export const PROMPT_STATUS_ARCHIVED   = 'archived'    as const;
export const PROMPT_STATUS_DEPRECATED = 'deprecated'  as const;

export const SUPPORTED_PROMPT_STATUSES = [
  PROMPT_STATUS_DRAFT,
  PROMPT_STATUS_PUBLISHED,
  PROMPT_STATUS_ARCHIVED,
  PROMPT_STATUS_DEPRECATED,
] as const;

export type PromptStatus = (typeof SUPPORTED_PROMPT_STATUSES)[number];

// ---------------------------------------------------------------------------
// Allowed Template Variables (strict whitelist — unknown vars block publish)
// ---------------------------------------------------------------------------

export const PROMPT_VAR_CLINIC_NAME          = '{{clinic_name}}'         as const;
export const PROMPT_VAR_TIMEZONE             = '{{timezone}}'            as const;
export const PROMPT_VAR_LANGUAGE             = '{{language}}'            as const;
export const PROMPT_VAR_BUSINESS_HOURS       = '{{business_hours}}'      as const;
export const PROMPT_VAR_DOCTOR_LIST          = '{{doctor_list}}'         as const;
export const PROMPT_VAR_CLINIC_PHONE         = '{{clinic_phone}}'        as const;
export const PROMPT_VAR_CLINIC_ADDRESS       = '{{clinic_address}}'      as const;
export const PROMPT_VAR_CLINIC_EMAIL         = '{{clinic_email}}'        as const;
export const PROMPT_VAR_CLINIC_WEBSITE       = '{{clinic_website}}'      as const;
export const PROMPT_VAR_TODAY                = '{{today}}'               as const;
export const PROMPT_VAR_CURRENT_TIME         = '{{current_time}}'        as const;
export const PROMPT_VAR_TENANT_NAME          = '{{tenant_name}}'         as const;
export const PROMPT_VAR_APPOINTMENT_DURATION = '{{appointment_duration}}' as const;
export const PROMPT_VAR_GREETING_MESSAGE     = '{{greeting_message}}'    as const;
export const PROMPT_VAR_SUPPORTED_LANGUAGES  = '{{supported_languages}}' as const;

export const ALLOWED_PROMPT_VARIABLES: ReadonlySet<string> = new Set([
  PROMPT_VAR_CLINIC_NAME,
  PROMPT_VAR_TIMEZONE,
  PROMPT_VAR_LANGUAGE,
  PROMPT_VAR_BUSINESS_HOURS,
  PROMPT_VAR_DOCTOR_LIST,
  PROMPT_VAR_CLINIC_PHONE,
  PROMPT_VAR_CLINIC_ADDRESS,
  PROMPT_VAR_CLINIC_EMAIL,
  PROMPT_VAR_CLINIC_WEBSITE,
  PROMPT_VAR_TODAY,
  PROMPT_VAR_CURRENT_TIME,
  PROMPT_VAR_TENANT_NAME,
  PROMPT_VAR_APPOINTMENT_DURATION,
  PROMPT_VAR_GREETING_MESSAGE,
  PROMPT_VAR_SUPPORTED_LANGUAGES,
]);

// ---------------------------------------------------------------------------
// Validation Limits
// ---------------------------------------------------------------------------

export const MAX_PROMPT_CONTENT_LENGTH = 32_768; // characters

// Patterns that are NEVER allowed inside prompt content (security)
export const BLOCKED_CONTENT_PATTERNS: ReadonlyArray<RegExp> = [
  /api[-_]?key\s*[:=]\s*\S+/i,
  /password\s*[:=]\s*\S+/i,
  /secret\s*[:=]\s*\S+/i,
  /bearer\s+[a-zA-Z0-9\-_]+\.[a-zA-Z0-9\-_]+/i,
  /sk-[a-zA-Z0-9]{32,}/,              // OpenAI key pattern
];

// ---------------------------------------------------------------------------
// Domain Event Types
// ---------------------------------------------------------------------------

export const EVENT_PROMPT_CREATED            = 'prompt.created'            as const;
export const EVENT_PROMPT_UPDATED            = 'prompt.updated'            as const;
export const EVENT_PROMPT_PUBLISHED          = 'prompt.published'          as const;
export const EVENT_PROMPT_ARCHIVED           = 'prompt.archived'           as const;
export const EVENT_PROMPT_ROLLED_BACK        = 'prompt.rolled_back'        as const;
export const EVENT_PROMPT_COMPOSE_REQUESTED  = 'prompt.compose.requested'  as const;
export const EVENT_PROMPT_VALIDATION_FAILED  = 'prompt.validation.failed'  as const;
export const EVENT_PROMPT_CACHE_INVALIDATED  = 'prompt.cache.invalidated'  as const;

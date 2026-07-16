/**
 * AI Engine Constants
 */

// Supported Intents (per 13_AI_Engine_Contract.md)
export const INTENT_GREETING = 'Greeting' as const;
export const INTENT_GOODBYE = 'Goodbye' as const;
export const INTENT_BOOK_APPOINTMENT = 'BookAppointment' as const;
export const INTENT_RESCHEDULE_APPOINTMENT = 'RescheduleAppointment' as const;
export const INTENT_CANCEL_APPOINTMENT = 'CancelAppointment' as const;
export const INTENT_CHECK_AVAILABILITY = 'CheckAvailability' as const;
export const INTENT_CLINIC_INFORMATION = 'ClinicInformation' as const;
export const INTENT_BUSINESS_HOURS = 'BusinessHours' as const;
export const INTENT_FALLBACK = 'Fallback' as const;
export const INTENT_UNKNOWN = 'Unknown' as const;
export const INTENT_EMERGENCY_ESCALATION = 'EmergencyEscalation' as const;

export const SUPPORTED_INTENTS = [
  INTENT_GREETING,
  INTENT_GOODBYE,
  INTENT_BOOK_APPOINTMENT,
  INTENT_RESCHEDULE_APPOINTMENT,
  INTENT_CANCEL_APPOINTMENT,
  INTENT_CHECK_AVAILABILITY,
  INTENT_CLINIC_INFORMATION,
  INTENT_BUSINESS_HOURS,
  INTENT_FALLBACK,
  INTENT_UNKNOWN,
  INTENT_EMERGENCY_ESCALATION,
] as const;

export type AiIntent = (typeof SUPPORTED_INTENTS)[number];

// Supported Providers
export const PROVIDER_OPENAI = 'openai' as const;
export const PROVIDER_MOCK = 'mock' as const;

export const SUPPORTED_PROVIDERS = [
  PROVIDER_OPENAI,
  PROVIDER_MOCK,
] as const;

export type AiProviderName = (typeof SUPPORTED_PROVIDERS)[number];

// Default Model Configurations
export const DEFAULT_AI_PROVIDER = PROVIDER_OPENAI;
export const DEFAULT_AI_MODEL = 'gpt-4o-mini'; // default cost-effective model
export const FALLBACK_AI_MODEL = 'gpt-4o';      // high-reasoning fallback

// Confidence thresholds
export const DEFAULT_CONFIDENCE_THRESHOLD = 0.7;

// Retry Settings
export const DEFAULT_MAX_RETRIES = 3;
export const DEFAULT_RETRY_DELAY_MS = 1000;

// Domain Event Types
export const EVENT_AI_SESSION_STARTED = 'ai.session.started' as const;
export const EVENT_AI_SESSION_COMPLETED = 'ai.session.completed' as const;
export const EVENT_AI_PROMPT_VERSION_USED = 'ai.prompt.version.used' as const;
export const EVENT_AI_PROVIDER_CHANGED = 'ai.provider.changed' as const;
export const EVENT_AI_FALLBACK_TRIGGERED = 'ai.fallback.triggered' as const;
export const EVENT_AI_TOOL_REQUEST_GENERATED = 'ai.tool.request.generated' as const;

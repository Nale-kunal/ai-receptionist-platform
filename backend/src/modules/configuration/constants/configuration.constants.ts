/**
 * Configuration Constants
 *
 * Single source of truth for cache, routing, providers, and default properties
 * used in the Configuration module.
 */

export const CONFIGURATION_ROUTE_PREFIX = '/api/v1/configurations' as const;

export const CONFIGURATION_CACHE_TTL_SECONDS = 300 as const;
export const CONFIGURATION_CACHE_MAX_SIZE = 1000 as const;

// Valid providers
export const PROVIDERS_AI = ['openai', 'google', 'anthropic'] as const;
export const PROVIDERS_TELEPHONY = ['twilio', 'vonage', 'plivo'] as const;
export const PROVIDERS_CALENDAR = ['google', 'outlook'] as const;
export const PROVIDERS_SMTP = ['nodemailer', 'sendgrid', 'ses'] as const;

export type AiProvider = typeof PROVIDERS_AI[number];
export type TelephonyProvider = typeof PROVIDERS_TELEPHONY[number];
export type CalendarProvider = typeof PROVIDERS_CALENDAR[number];
export type SmtpProvider = typeof PROVIDERS_SMTP[number];

// Localization Defaults
export const DEFAULT_TIMEZONE = 'UTC' as const;
export const DEFAULT_COUNTRY = 'US' as const;
export const DEFAULT_LANGUAGE = 'en' as const;
export const DEFAULT_DATE_FORMAT = 'YYYY-MM-DD' as const;
export const DEFAULT_TIME_FORMAT = 'HH:mm' as const;

// Feature Flags
export const FLAG_VOICE_ENABLED = 'voiceEnabled' as const;
export const FLAG_AI_ENABLED = 'aiEnabled' as const;
export const FLAG_SMS_ENABLED = 'smsEnabled' as const;
export const FLAG_EMAIL_ENABLED = 'emailEnabled' as const;
export const FLAG_CALL_RECORDING_ENABLED = 'callRecordingEnabled' as const;
export const FLAG_ANALYTICS_ENABLED = 'analyticsEnabled' as const;

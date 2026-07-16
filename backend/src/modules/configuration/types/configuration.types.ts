/**
 * Configuration Module Types & Settings Structs
 */

import type {
  AiProvider,
  TelephonyProvider,
  CalendarProvider,
  SmtpProvider,
} from '../constants/configuration.constants';

export interface BusinessHour {
  dayOfWeek: number; // 0-6 (Sunday-Saturday)
  openTime: string;  // e.g. "09:00"
  closeTime: string; // e.g. "17:00"
  isClosed: boolean;
}

export interface Holiday {
  date: string; // YYYY-MM-DD
  name: string;
}

export interface BusinessSettings {
  businessHours: BusinessHour[];
  holidays: Holiday[];
  appointmentDuration: number; // in minutes
  bookingRules?: {
    minAdvanceHours?: number;
    maxAdvanceDays?: number;
    [key: string]: unknown;
  };
  cancellationRules?: {
    minNoticeHours?: number;
    [key: string]: unknown;
  };
  reschedulingRules?: {
    minNoticeHours?: number;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface VoiceSettings {
  voiceModel: string;
  greeting: string;
  prompt: string;
  language: string;
  [key: string]: unknown;
}

export interface AiSettings {
  promptAssignment: string;
  tone: string;
  greeting: string;
  provider: AiProvider;
  [key: string]: unknown;
}

export interface CalendarSettings {
  calendarProvider: CalendarProvider;
  syncIntervalMinutes: number;
  [key: string]: unknown;
}

export interface NotificationSettings {
  smsEnabled: boolean;
  emailEnabled: boolean;
  notificationPreferences?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface BrandingSettings {
  logo?: string;
  primaryColor?: string;
  secondaryColor?: string;
  clinicName: string;
  website?: string;
  emailBranding?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface LocalizationSettings {
  language: string;
  country: string;
  timezone: string;
  dateFormat: string;
  timeFormat: string;
  [key: string]: unknown;
}

export interface FeatureFlagsSettings {
  voiceEnabled: boolean;
  aiEnabled: boolean;
  callRecordingEnabled: boolean;
  smsEnabled: boolean;
  emailEnabled: boolean;
  analyticsEnabled: boolean;
  premiumFeatures: string[];
  [key: string]: unknown;
}

export interface ProvidersSettings {
  openai?: Record<string, unknown>;
  twilio?: Record<string, unknown>;
  googleCalendar?: Record<string, unknown>;
  smtp?: {
    provider: SmtpProvider;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

/**
 * Output representation of a Configuration version.
 * Ensures strict typing of nested settings instead of raw Json.
 */
export interface SafeConfiguration {
  id: string;
  tenantId: string;
  clinicId: string | null;
  version: number;
  isActive: boolean;
  createdBy: string;
  createdAt: Date;
  changeSummary: string | null;
  previousVersionId: string | null;
  rollbackFromVersion: number | null;
  
  // Typed categories
  business: BusinessSettings;
  voice: VoiceSettings;
  ai: AiSettings;
  calendar: CalendarSettings;
  notification: NotificationSettings;
  branding: BrandingSettings;
  localization: LocalizationSettings;
  featureFlags: FeatureFlagsSettings;
  providers: ProvidersSettings;
}

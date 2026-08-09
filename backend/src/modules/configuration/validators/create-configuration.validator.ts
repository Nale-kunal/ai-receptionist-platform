/**
 * Create Configuration Payload Validator
 */

import { z } from 'zod';
import {
  PROVIDERS_AI,
  PROVIDERS_CALENDAR,
  PROVIDERS_TELEPHONY,
  PROVIDERS_SMTP,
} from '../constants/configuration.constants';

// Timezone Validation Helper
export function isValidTimezone(tz: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch (e) {
    return false;
  }
}

const TimezoneSchema = z.string().refine(isValidTimezone, {
  message: 'Invalid IANA timezone name',
});

const HexColorSchema = z
  .string()
  .regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, 'Must be a valid hex color code')
  .optional();

export const BusinessHourSchema = z
  .object({
    dayOfWeek: z.number().int().min(0).max(6),
    openTime: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/, 'Must be HH:mm format'),
    closeTime: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/, 'Must be HH:mm format'),
    isClosed: z.boolean(),
  })
  .refine(
    (data) => {
      if (data.isClosed) return true;
      const [openH, openM] = data.openTime.split(':').map(Number);
      const [closeH, closeM] = data.closeTime.split(':').map(Number);
      const openMinutes = openH * 60 + openM;
      const closeMinutes = closeH * 60 + closeM;
      return openMinutes < closeMinutes;
    },
    {
      message: 'Opening time must be strictly before closing time',
      path: ['closeTime'],
    },
  );

export const HolidaySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD format'),
  name: z.string().min(1, 'Holiday name cannot be empty'),
});

// Detailed schedule item (frontend UI format — day-name based)
const DetailedScheduleItemSchema = z.object({
  day: z.string().min(1),
  startTime: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/, 'Must be HH:mm format').optional(),
  endTime: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/, 'Must be HH:mm format').optional(),
  isClosed: z.boolean().optional(),
});

export const BusinessSettingsSchema = z.object({
  // Structured array format (canonical DB format — dayOfWeek number based)
  businessHours: z.array(BusinessHourSchema).optional().default([]),

  // Structured schedule alias used by clinic settings UI (same schema, named differently)
  businessHoursSchedule: z.array(BusinessHourSchema).optional(),

  // Day-name schedule from SettingsHub UI (e.g. [{day: "Monday", startTime: "09:00", ...}])
  detailedSchedule: z.array(DetailedScheduleItemSchema).optional(),

  // Working day names ["Monday","Tuesday",...] toggle from settings
  workingDays: z.array(z.string()).optional(),

  // Display-only label for AI rules e.g. "Mon-Fri 09:00-17:00"
  businessHoursLabel: z.string().optional(),

  holidays: z.array(HolidaySchema).default([]),
  appointmentDuration: z.number().int().min(5).max(240).optional().default(30),
  bookingRules: z
    .object({
      minAdvanceHours: z.number().int().nonnegative().optional(),
      maxAdvanceDays: z.number().int().positive().optional(),
    })
    .optional(),
  cancellationRules: z
    .object({
      minNoticeHours: z.number().int().nonnegative().optional(),
    })
    .optional(),
  reschedulingRules: z
    .object({
      minNoticeHours: z.number().int().nonnegative().optional(),
    })
    .optional(),
  // Clinic identity fields stored alongside hours for convenience
  clinicName: z.string().optional(),
  contactPhone: z.string().optional(),
  contactEmail: z.string().email().optional(),
  address: z.string().optional(),
  timezone: z.string().optional(),
  aiGreeting: z.string().optional(),
  bookingRulesText: z.string().optional(),
  cancellationRulesText: z.string().optional(),
  holidaySchedule: z.string().optional(),
});

export const VoiceSettingsSchema = z.object({
  voiceModel: z.string().min(1, 'Voice model required'),
  greeting: z.string().min(1, 'Greeting prompt required'),
  prompt: z.string().min(1, 'System prompt required'),
  language: z.string().min(2, 'Language code required'),
});

export const AiSettingsSchema = z.object({
  promptAssignment: z.string().min(1, 'Prompt assignment required'),
  tone: z.string().min(1, 'Tone style required'),
  greeting: z.string().min(1, 'Greeting prompt required'),
  provider: z.enum(PROVIDERS_AI),
});

export const CalendarSettingsSchema = z.object({
  calendarProvider: z.enum(PROVIDERS_CALENDAR),
  syncIntervalMinutes: z.number().int().min(1).max(1440),
});

export const NotificationSettingsSchema = z.object({
  smsEnabled: z.boolean(),
  emailEnabled: z.boolean(),
  notificationPreferences: z.record(z.unknown()).optional(),
});

export const BrandingSettingsSchema = z.object({
  logo: z.string().url('Logo must be a valid URL').or(z.string().length(0)).optional(),
  primaryColor: HexColorSchema,
  secondaryColor: HexColorSchema,
  clinicName: z.string().min(1, 'Clinic name is required'),
  website: z.string().url('Website must be a valid URL').or(z.string().length(0)).optional(),
  emailBranding: z.record(z.unknown()).optional(),
});

export const LocalizationSettingsSchema = z.object({
  language: z.string().min(2),
  country: z.string().min(2),
  timezone: TimezoneSchema,
  dateFormat: z.string().min(1),
  timeFormat: z.string().min(1),
});

export const FeatureFlagsSettingsSchema = z.object({
  voiceEnabled: z.boolean(),
  aiEnabled: z.boolean(),
  callRecordingEnabled: z.boolean(),
  smsEnabled: z.boolean(),
  emailEnabled: z.boolean(),
  analyticsEnabled: z.boolean(),
  premiumFeatures: z.array(z.string()).default([]),
});

export const ProvidersSettingsSchema = z.object({
  openai: z.record(z.unknown()).optional(),
  twilio: z.record(z.unknown()).optional(),
  googleCalendar: z.record(z.unknown()).optional(),
  smtp: z
    .object({
      provider: z.enum(PROVIDERS_SMTP),
    })
    .catchall(z.unknown())
    .optional(),
});

export const CreateConfigurationSchema = z.object({
  clinicId: z.string().uuid('Clinic ID must be a valid UUID').nullable(),
  changeSummary: z.string().max(255).optional(),
  business: BusinessSettingsSchema,
  voice: VoiceSettingsSchema,
  ai: AiSettingsSchema,
  calendar: CalendarSettingsSchema,
  notification: NotificationSettingsSchema,
  branding: BrandingSettingsSchema,
  localization: LocalizationSettingsSchema,
  featureFlags: FeatureFlagsSettingsSchema,
  providers: ProvidersSettingsSchema,
});

export type CreateConfigurationDto = z.infer<typeof CreateConfigurationSchema>;

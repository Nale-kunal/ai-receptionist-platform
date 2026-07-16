/**
 * Update Configuration Payload Validator (Partial modifications)
 */

import { z } from 'zod';
import {
  BusinessSettingsSchema,
  VoiceSettingsSchema,
  AiSettingsSchema,
  CalendarSettingsSchema,
  NotificationSettingsSchema,
  BrandingSettingsSchema,
  LocalizationSettingsSchema,
  FeatureFlagsSettingsSchema,
  ProvidersSettingsSchema,
} from './create-configuration.validator';

export const UpdateConfigurationSchema = z
  .object({
    changeSummary: z.string().max(255).optional(),
    business: BusinessSettingsSchema.partial().optional(),
    voice: VoiceSettingsSchema.partial().optional(),
    ai: AiSettingsSchema.partial().optional(),
    calendar: CalendarSettingsSchema.partial().optional(),
    notification: NotificationSettingsSchema.partial().optional(),
    branding: BrandingSettingsSchema.partial().optional(),
    localization: LocalizationSettingsSchema.partial().optional(),
    featureFlags: FeatureFlagsSettingsSchema.partial().optional(),
    providers: ProvidersSettingsSchema.partial().optional(),
  })
  .refine(
    (data) => {
      // Ensure at least one update section is provided
      const keys = [
        'business',
        'voice',
        'ai',
        'calendar',
        'notification',
        'branding',
        'localization',
        'featureFlags',
        'providers',
      ];
      return keys.some((key) => (data as any)[key] !== undefined);
    },
    {
      message: 'At least one configuration category must be provided for update.',
    },
  );

export type UpdateConfigurationDto = z.infer<typeof UpdateConfigurationSchema>;

/**
 * Configuration Validators Unit Tests
 */

import { CreateConfigurationSchema } from '../validators/create-configuration.validator';
import { UpdateConfigurationSchema } from '../validators/update-configuration.validator';
import { RollbackConfigurationSchema } from '../validators/rollback-configuration.validator';

describe('Configuration Validators', () => {
  const validConfig = {
    clinicId: '550e8400-e29b-41d4-a716-446655440001',
    changeSummary: 'Initial setup config',
    business: {
      businessHours: [
        { dayOfWeek: 1, openTime: '09:00', closeTime: '17:00', isClosed: false },
        { dayOfWeek: 2, openTime: '09:00', closeTime: '17:00', isClosed: false },
      ],
      holidays: [{ date: '2026-12-25', name: 'Christmas' }],
      appointmentDuration: 30,
    },
    voice: {
      voiceModel: 'alloy',
      greeting: 'Hello, welcome to our clinic.',
      prompt: 'Be helpful and concise.',
      language: 'en',
    },
    ai: {
      promptAssignment: 'receptionist-prompt-v1',
      tone: 'professional',
      greeting: 'Hi, this is your AI helper.',
      provider: 'openai',
    },
    calendar: {
      calendarProvider: 'google',
      syncIntervalMinutes: 15,
    },
    notification: {
      smsEnabled: true,
      emailEnabled: true,
    },
    branding: {
      logo: 'https://example.com/logo.png',
      primaryColor: '#007FFF',
      secondaryColor: '#FF7F00',
      clinicName: 'Smile Care Dental Clinic',
      website: 'https://example.com',
    },
    localization: {
      language: 'en',
      country: 'US',
      timezone: 'UTC',
      dateFormat: 'YYYY-MM-DD',
      timeFormat: 'HH:mm',
    },
    featureFlags: {
      voiceEnabled: true,
      aiEnabled: true,
      callRecordingEnabled: false,
      smsEnabled: true,
      emailEnabled: true,
      analyticsEnabled: false,
      premiumFeatures: ['custom-prompts'],
    },
    providers: {
      openai: { apiKey: 'sk-test' },
      twilio: { accountSid: 'AC123' },
    },
  };

  describe('CreateConfigurationSchema', () => {
    it('should validate successfully with a valid payload', () => {
      const parsed = CreateConfigurationSchema.safeParse(validConfig);
      expect(parsed.success).toBe(true);
    });

    it('should fail if timezone is not standard IANA timezone name', () => {
      const invalid = {
        ...validConfig,
        localization: {
          ...validConfig.localization,
          timezone: 'America/Not_Real_Timezone',
        },
      };
      const parsed = CreateConfigurationSchema.safeParse(invalid);
      expect(parsed.success).toBe(false);
    });

    it('should fail if primaryColor is not a hex color code', () => {
      const invalid = {
        ...validConfig,
        branding: {
          ...validConfig.branding,
          primaryColor: 'not-hex-color',
        },
      };
      const parsed = CreateConfigurationSchema.safeParse(invalid);
      expect(parsed.success).toBe(false);
    });

    it('should fail if businessHours closeTime is equal or before openTime', () => {
      const invalid = {
        ...validConfig,
        business: {
          ...validConfig.business,
          businessHours: [
            { dayOfWeek: 1, openTime: '17:00', closeTime: '09:00', isClosed: false },
          ],
        },
      };
      const parsed = CreateConfigurationSchema.safeParse(invalid);
      expect(parsed.success).toBe(false);
    });

    it('should fail if appointmentDuration is less than 5 minutes', () => {
      const invalid = {
        ...validConfig,
        business: {
          ...validConfig.business,
          appointmentDuration: 3,
        },
      };
      const parsed = CreateConfigurationSchema.safeParse(invalid);
      expect(parsed.success).toBe(false);
    });

    it('should fail if provider is not in the valid provider list', () => {
      const invalid = {
        ...validConfig,
        ai: {
          ...validConfig.ai,
          provider: 'invalid-provider-name',
        },
      };
      const parsed = CreateConfigurationSchema.safeParse(invalid);
      expect(parsed.success).toBe(false);
    });
  });

  describe('UpdateConfigurationSchema', () => {
    it('should validate partial configuration blocks', () => {
      const payload = {
        business: {
          appointmentDuration: 45,
        },
        branding: {
          primaryColor: '#000000',
        },
      };
      const parsed = UpdateConfigurationSchema.safeParse(payload);
      expect(parsed.success).toBe(true);
    });

    it('should fail if an empty object is sent (no updates specified)', () => {
      const parsed = UpdateConfigurationSchema.safeParse({});
      expect(parsed.success).toBe(false);
    });
  });

  describe('RollbackConfigurationSchema', () => {
    it('should allow optional change summary', () => {
      const parsed = RollbackConfigurationSchema.safeParse({
        changeSummary: 'Rolling back to v1 due to prompt issues',
      });
      expect(parsed.success).toBe(true);
    });
  });
});

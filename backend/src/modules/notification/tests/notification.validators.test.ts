/**
 * Notification Validator Unit Tests
 */

import { CreateNotificationSchema } from '../validators/create-notification.validator';
import { ListNotificationsSchema } from '../validators/list-notifications.validator';
import { UpdatePreferencesSchema } from '../validators/update-preferences.validator';

const CLINIC_ID = '550e8400-e29b-41d4-a716-446655440001';

describe('CreateNotificationSchema', () => {
  const valid = {
    clinicId: CLINIC_ID,
    recipient: 'test@example.com',
    channel: 'email',
    type: 'appointment_confirmation',
    templateName: 'appointment_confirmation',
  };

  it('should pass for a valid payload', () => {
    const result = CreateNotificationSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('should fail when clinicId is not a valid UUID', () => {
    const result = CreateNotificationSchema.safeParse({ ...valid, clinicId: 'invalid-uuid' });
    expect(result.success).toBe(false);
  });

  it('should fail when channel is invalid', () => {
    const result = CreateNotificationSchema.safeParse({ ...valid, channel: 'fax' });
    expect(result.success).toBe(false);
  });

  it('should pass with scheduledAt as a valid ISO-8601 string', () => {
    const result = CreateNotificationSchema.safeParse({ ...valid, scheduledAt: '2025-01-01T09:00:00Z' });
    expect(result.success).toBe(true);
  });
});

describe('UpdatePreferencesSchema', () => {
  it('should pass with valid partial preferences', () => {
    const result = UpdatePreferencesSchema.safeParse({ smsEnabled: false, preferredContactMethod: 'email' });
    expect(result.success).toBe(true);
  });

  it('should fail if no fields are provided', () => {
    const result = UpdatePreferencesSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe('ListNotificationsSchema', () => {
  it('should validate query and assign correct default pagination limit', () => {
    const result = ListNotificationsSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.limit).toBe(20);
      expect(result.data.offset).toBe(0);
    }
  });
});

/**
 * Calendar Validator Unit Tests
 */

import { ConnectCalendarSchema } from '../validators/connect-calendar.validator';
import { ListConnectionsSchema } from '../validators/list-connections.validator';

const CLINIC_ID = '550e8400-e29b-41d4-a716-446655440001';
const DOCTOR_ID = '550e8400-e29b-41d4-a716-446655440002';

describe('ConnectCalendarSchema', () => {
  const valid = {
    clinicId:    CLINIC_ID,
    provider:    'google',
    calendarId:  'primary',
    accessToken: 'ya29.valid-oauth-token',
  };

  it('should parse valid connect payload', () => {
    const result = ConnectCalendarSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('should fail with invalid provider', () => {
    const result = ConnectCalendarSchema.safeParse({ ...valid, provider: 'apple' });
    expect(result.success).toBe(false);
  });

  it('should fail with invalid clinicId UUID', () => {
    const result = ConnectCalendarSchema.safeParse({ ...valid, clinicId: 'invalid-uuid' });
    expect(result.success).toBe(false);
  });

  it('should accept valid doctorId and tokenExpiry', () => {
    const result = ConnectCalendarSchema.safeParse({
      ...valid,
      doctorId:    DOCTOR_ID,
      tokenExpiry: '2025-12-31T23:59:59Z',
    });
    expect(result.success).toBe(true);
  });
});

describe('ListConnectionsSchema', () => {
  it('should apply limit and offset defaults', () => {
    const result = ListConnectionsSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.limit).toBe(20);
      expect(result.data.offset).toBe(0);
    }
  });

  it('should reject invalid status filter', () => {
    const result = ListConnectionsSchema.safeParse({ status: 'invalid-status' });
    expect(result.success).toBe(false);
  });
});

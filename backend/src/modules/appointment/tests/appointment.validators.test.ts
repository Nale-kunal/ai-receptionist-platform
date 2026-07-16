/**
 * Appointment Validator Unit Tests
 */

import { CreateAppointmentSchema }     from '../validators/create-appointment.validator';
import { UpdateAppointmentSchema }     from '../validators/update-appointment.validator';
import { RescheduleAppointmentSchema } from '../validators/reschedule-appointment.validator';
import { CancelAppointmentSchema }     from '../validators/cancel-appointment.validator';
import { ListAppointmentsSchema }      from '../validators/list-appointments.validator';

const CLINIC_ID  = '550e8400-e29b-41d4-a716-446655440001';
const DOCTOR_ID  = '550e8400-e29b-41d4-a716-446655440002';
const PATIENT_ID = '550e8400-e29b-41d4-a716-446655440003';

// ---------------------------------------------------------------------------
// CreateAppointmentSchema
// ---------------------------------------------------------------------------

describe('CreateAppointmentSchema', () => {
  const valid = {
    clinicId:  CLINIC_ID,
    doctorId:  DOCTOR_ID,
    patientId: PATIENT_ID,
    startTime: '2025-01-01T09:00:00.000Z',
    endTime:   '2025-01-01T09:30:00.000Z',
  };

  it('should pass for a valid booking payload', () => {
    const result = CreateAppointmentSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('should default source to "dashboard"', () => {
    const result = CreateAppointmentSchema.safeParse(valid);
    expect(result.success && result.data.source).toBe('dashboard');
  });

  it('should default timezone to "UTC"', () => {
    const result = CreateAppointmentSchema.safeParse(valid);
    expect(result.success && result.data.timezone).toBe('UTC');
  });

  it('should fail when clinicId is not a UUID', () => {
    const result = CreateAppointmentSchema.safeParse({ ...valid, clinicId: 'not-a-uuid' });
    expect(result.success).toBe(false);
  });

  it('should fail when endTime <= startTime', () => {
    const result = CreateAppointmentSchema.safeParse({
      ...valid,
      endTime: '2025-01-01T09:00:00.000Z', // same as startTime
    });
    expect(result.success).toBe(false);
  });

  it('should fail when endTime is before startTime', () => {
    const result = CreateAppointmentSchema.safeParse({
      ...valid,
      endTime: '2025-01-01T08:00:00.000Z',
    });
    expect(result.success).toBe(false);
  });

  it('should fail when startTime is not a valid datetime string', () => {
    const result = CreateAppointmentSchema.safeParse({
      ...valid,
      startTime: 'not-a-date',
    });
    expect(result.success).toBe(false);
  });

  it('should accept optional notes', () => {
    const result = CreateAppointmentSchema.safeParse({ ...valid, notes: 'Please bring X-rays.' });
    expect(result.success).toBe(true);
  });

  it('should accept valid source values', () => {
    const result = CreateAppointmentSchema.safeParse({ ...valid, source: 'ai_voice' });
    expect(result.success).toBe(true);
  });

  it('should reject invalid source values', () => {
    const result = CreateAppointmentSchema.safeParse({ ...valid, source: 'unknown_source' });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// UpdateAppointmentSchema
// ---------------------------------------------------------------------------

describe('UpdateAppointmentSchema', () => {
  it('should pass with null notes', () => {
    const result = UpdateAppointmentSchema.safeParse({ notes: null });
    expect(result.success).toBe(true);
  });

  it('should pass with no fields (empty update)', () => {
    const result = UpdateAppointmentSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('should reject notes longer than 2000 characters', () => {
    const result = UpdateAppointmentSchema.safeParse({ notes: 'x'.repeat(2001) });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// RescheduleAppointmentSchema
// ---------------------------------------------------------------------------

describe('RescheduleAppointmentSchema', () => {
  const valid = {
    startTime: '2025-02-01T10:00:00.000Z',
    endTime:   '2025-02-01T10:30:00.000Z',
  };

  it('should pass for valid reschedule payload', () => {
    const result = RescheduleAppointmentSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('should fail when endTime <= startTime', () => {
    const result = RescheduleAppointmentSchema.safeParse({
      ...valid,
      endTime: '2025-02-01T09:00:00.000Z',
    });
    expect(result.success).toBe(false);
  });

  it('should accept optional timezone', () => {
    const result = RescheduleAppointmentSchema.safeParse({ ...valid, timezone: 'America/New_York' });
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// CancelAppointmentSchema
// ---------------------------------------------------------------------------

describe('CancelAppointmentSchema', () => {
  it('should pass with no body', () => {
    const result = CancelAppointmentSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('should pass with a cancellation reason', () => {
    const result = CancelAppointmentSchema.safeParse({ cancellationReason: 'Patient cancelled' });
    expect(result.success).toBe(true);
  });

  it('should pass with null reason', () => {
    const result = CancelAppointmentSchema.safeParse({ cancellationReason: null });
    expect(result.success).toBe(true);
  });

  it('should reject a reason longer than 500 characters', () => {
    const result = CancelAppointmentSchema.safeParse({ cancellationReason: 'x'.repeat(501) });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// ListAppointmentsSchema
// ---------------------------------------------------------------------------

describe('ListAppointmentsSchema', () => {
  it('should pass with no query parameters and use defaults', () => {
    const result = ListAppointmentsSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.limit).toBe(20);
      expect(result.data.offset).toBe(0);
    }
  });

  it('should coerce string numbers for limit and offset', () => {
    const result = ListAppointmentsSchema.safeParse({ limit: '10', offset: '5' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.limit).toBe(10);
      expect(result.data.offset).toBe(5);
    }
  });

  it('should reject invalid status values', () => {
    const result = ListAppointmentsSchema.safeParse({ status: 'invalid_status' });
    expect(result.success).toBe(false);
  });

  it('should reject limit > 100', () => {
    const result = ListAppointmentsSchema.safeParse({ limit: '200' });
    expect(result.success).toBe(false);
  });

  it('should pass with valid status', () => {
    const result = ListAppointmentsSchema.safeParse({ status: 'confirmed' });
    expect(result.success).toBe(true);
  });

  it('should accept valid date range', () => {
    const result = ListAppointmentsSchema.safeParse({
      startFrom: '2025-01-01T00:00:00.000Z',
      startTo:   '2025-01-31T23:59:59.000Z',
    });
    expect(result.success).toBe(true);
  });
});

/**
 * Doctor Validators Unit Tests
 */

import { CreateDoctorSchema } from '../validators/create-doctor.validator';
import { UpdateDoctorSchema } from '../validators/update-doctor.validator';
import { UpdateDoctorStatusSchema } from '../validators/update-status.validator';
import { DoctorWorkingHoursListSchema } from '../validators/working-hours.validator';
import { DoctorLeavesListSchema } from '../validators/leaves.validator';

describe('Doctor Validators', () => {
  const validDoctorPayload = {
    clinicId: '550e8400-e29b-41d4-a716-446655440001',
    fullName: 'Dr. John Doe',
    displayName: 'Dr. Doe',
    specialization: 'General Dentistry',
    licenseNumber: 'LIC-12345',
    biography: 'Experienced dentist.',
    email: 'johndoe@example.com',
    phone: '+15555551234',
    profilePhoto: 'https://example.com/photo.png',
  };

  describe('CreateDoctorSchema', () => {
    it('should validate successfully with a valid payload', () => {
      const parsed = CreateDoctorSchema.safeParse(validDoctorPayload);
      expect(parsed.success).toBe(true);
    });

    it('should fail if email is invalid', () => {
      const invalid = { ...validDoctorPayload, email: 'not-an-email' };
      const parsed = CreateDoctorSchema.safeParse(invalid);
      expect(parsed.success).toBe(false);
    });

    it('should fail if phone is not E.164 compatible', () => {
      const invalid = { ...validDoctorPayload, phone: '123-abc-456' };
      const parsed = CreateDoctorSchema.safeParse(invalid);
      expect(parsed.success).toBe(false);
    });
  });

  describe('UpdateDoctorSchema', () => {
    it('should validate partial details', () => {
      const parsed = UpdateDoctorSchema.safeParse({
        fullName: 'Dr. Jane Smith',
        specialization: 'Orthodontics',
      });
      expect(parsed.success).toBe(true);
    });

    it('should fail if empty payload is sent', () => {
      const parsed = UpdateDoctorSchema.safeParse({});
      expect(parsed.success).toBe(false);
    });
  });

  describe('UpdateDoctorStatusSchema', () => {
    it('should validate allowed status values', () => {
      const parsed = UpdateDoctorStatusSchema.safeParse({ status: 'unavailable' });
      expect(parsed.success).toBe(true);
    });

    it('should reject deleted status in status update endpoint', () => {
      const parsed = UpdateDoctorStatusSchema.safeParse({ status: 'deleted' });
      expect(parsed.success).toBe(false);
    });
  });

  describe('DoctorWorkingHoursListSchema', () => {
    it('should validate correct hours and break format', () => {
      const parsed = DoctorWorkingHoursListSchema.safeParse({
        workingHours: [
          { dayOfWeek: 1, openTime: '09:00', closeTime: '17:00', breakStart: '12:00', breakEnd: '13:00', isClosed: false },
        ],
      });
      expect(parsed.success).toBe(true);
    });

    it('should fail if closeTime is before openTime', () => {
      const parsed = DoctorWorkingHoursListSchema.safeParse({
        workingHours: [
          { dayOfWeek: 1, openTime: '17:00', closeTime: '09:00', isClosed: false },
        ],
      });
      expect(parsed.success).toBe(false);
    });

    it('should fail if breakEnd is before breakStart', () => {
      const parsed = DoctorWorkingHoursListSchema.safeParse({
        workingHours: [
          { dayOfWeek: 1, openTime: '09:00', closeTime: '17:00', breakStart: '13:00', breakEnd: '12:00', isClosed: false },
        ],
      });
      expect(parsed.success).toBe(false);
    });

    it('should fail if break falls after closing time (18:00 - 19:00 vs close 17:00)', () => {
      const parsed = DoctorWorkingHoursListSchema.safeParse({
        workingHours: [
          { dayOfWeek: 1, openTime: '09:00', closeTime: '17:00', breakStart: '18:00', breakEnd: '19:00', isClosed: false },
        ],
      });
      expect(parsed.success).toBe(false);
    });

    it('should fail if break starts before opening time (08:00 - 10:00 vs open 09:00)', () => {
      const parsed = DoctorWorkingHoursListSchema.safeParse({
        workingHours: [
          { dayOfWeek: 1, openTime: '09:00', closeTime: '17:00', breakStart: '08:00', breakEnd: '10:00', isClosed: false },
        ],
      });
      expect(parsed.success).toBe(false);
    });

    it('should fail if break extends beyond closing time (16:30 - 18:00 vs close 17:00)', () => {
      const parsed = DoctorWorkingHoursListSchema.safeParse({
        workingHours: [
          { dayOfWeek: 1, openTime: '09:00', closeTime: '17:00', breakStart: '16:30', breakEnd: '18:00', isClosed: false },
        ],
      });
      expect(parsed.success).toBe(false);
    });
  });

  describe('DoctorLeavesListSchema', () => {
    it('should validate valid date ranges', () => {
      const parsed = DoctorLeavesListSchema.safeParse({
        leaves: [
          { startDate: '2026-12-20', endDate: '2026-12-25', reason: 'Vacation' },
        ],
      });
      expect(parsed.success).toBe(true);
    });

    it('should fail if endDate is before startDate', () => {
      const parsed = DoctorLeavesListSchema.safeParse({
        leaves: [
          { startDate: '2026-12-25', endDate: '2026-12-20', reason: 'Vacation' },
        ],
      });
      expect(parsed.success).toBe(false);
    });
  });
});

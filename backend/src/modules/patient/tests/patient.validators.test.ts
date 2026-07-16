/**
 * Patient Validators Unit Tests
 */

import { CreatePatientSchema } from '../validators/create-patient.validator';
import { UpdatePatientSchema } from '../validators/update-patient.validator';
import { UpdatePatientStatusSchema } from '../validators/update-status.validator';

describe('Patient Validators', () => {
  const validPatientPayload = {
    clinicId: '550e8400-e29b-41d4-a716-446655440002',
    fullName: 'Jane Smith',
    phone: '+15555554321',
    email: 'janesmith@example.com',
    dateOfBirth: '1995-10-15',
    gender: 'female',
    preferredLanguage: 'en',
    preferredContactMethod: 'sms',
    emergencyContact: {
      name: 'John Smith',
      relationship: 'Spouse',
      phone: '+15555551111',
    },
  };

  describe('CreatePatientSchema', () => {
    it('should validate successfully with a valid payload', () => {
      const parsed = CreatePatientSchema.safeParse(validPatientPayload);
      expect(parsed.success).toBe(true);
    });

    it('should fail if phone is invalid', () => {
      const invalid = { ...validPatientPayload, phone: 'invalid-phone' };
      const parsed = CreatePatientSchema.safeParse(invalid);
      expect(parsed.success).toBe(false);
    });

    it('should fail if email format is invalid', () => {
      const invalid = { ...validPatientPayload, email: 'not-an-email' };
      const parsed = CreatePatientSchema.safeParse(invalid);
      expect(parsed.success).toBe(false);
    });

    it('should allow optional email to be null or undefined', () => {
      const { email, ...rest } = validPatientPayload;
      const parsed = CreatePatientSchema.safeParse(rest);
      expect(parsed.success).toBe(true);
    });
  });

  describe('UpdatePatientSchema', () => {
    it('should validate partial updates successfully', () => {
      const parsed = UpdatePatientSchema.safeParse({
        fullName: 'Jane Doe Updated',
      });
      expect(parsed.success).toBe(true);
    });

    it('should reject an empty update object', () => {
      const parsed = UpdatePatientSchema.safeParse({});
      expect(parsed.success).toBe(false);
    });
  });

  describe('UpdatePatientStatusSchema', () => {
    it('should accept valid status transitions', () => {
      const parsed = UpdatePatientStatusSchema.safeParse({ status: 'blocked' });
      expect(parsed.success).toBe(true);
    });

    it('should reject deleted status', () => {
      const parsed = UpdatePatientStatusSchema.safeParse({ status: 'deleted' });
      expect(parsed.success).toBe(false);
    });
  });
});

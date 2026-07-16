/**
 * Clinic Validators Unit Tests
 */

import { CreateClinicSchema } from '../validators/create-clinic.validator';
import { UpdateClinicSchema } from '../validators/update-clinic.validator';
import { UpdateClinicStatusSchema } from '../validators/update-status.validator';
import { TransferOwnershipSchema } from '../validators/transfer-ownership.validator';

describe('Clinic Validators', () => {
  const validClinicPayload = {
    ownerId: '550e8400-e29b-41d4-a716-446655440001',
    name: 'Smile Care Clinic',
    legalName: 'Smile Care Clinic Inc',
    slug: 'smile-care-clinic',
    timezone: 'America/New_York',
    country: 'US',
    primaryEmail: 'info@smilecare.com',
    primaryPhone: '+15555551234',
    website: 'https://smilecare.com',
    address: '123 Main St',
    city: 'New York',
    state: 'NY',
    postalCode: '10001',
    logoReference: 'https://example.com/logo.png',
    brandIdentifier: 'smilecare-branding',
    subscriptionId: 'sub-999',
    planId: 'premium-plan',
    subscriptionStatus: 'active',
  };

  describe('CreateClinicSchema', () => {
    it('should validate successfully with a valid payload', () => {
      const parsed = CreateClinicSchema.safeParse(validClinicPayload);
      expect(parsed.success).toBe(true);
    });

    it('should fail if timezone is not a valid IANA timezone name', () => {
      const invalid = { ...validClinicPayload, timezone: 'America/Not_Real_Timezone' };
      const parsed = CreateClinicSchema.safeParse(invalid);
      expect(parsed.success).toBe(false);
    });

    it('should fail if slug is not lowercase alphanumeric and hyphen-separated', () => {
      const invalid = { ...validClinicPayload, slug: 'Smile Care Clinic' };
      const parsed = CreateClinicSchema.safeParse(invalid);
      expect(parsed.success).toBe(false);
    });

    it('should fail if country code is not exactly 2 uppercase letters', () => {
      const invalid = { ...validClinicPayload, country: 'usa' };
      const parsed = CreateClinicSchema.safeParse(invalid);
      expect(parsed.success).toBe(false);
    });
  });

  describe('UpdateClinicSchema', () => {
    it('should validate partial details', () => {
      const parsed = UpdateClinicSchema.safeParse({
        name: 'New Smile Care Clinic Name',
        timezone: 'UTC',
      });
      expect(parsed.success).toBe(true);
    });

    it('should fail if an empty payload is sent (no updates specified)', () => {
      const parsed = UpdateClinicSchema.safeParse({});
      expect(parsed.success).toBe(false);
    });
  });

  describe('UpdateClinicStatusSchema', () => {
    it('should validate correct statuses', () => {
      const parsed = UpdateClinicStatusSchema.safeParse({ status: 'active' });
      expect(parsed.success).toBe(true);
    });

    it('should reject deleted status in status update endpoint', () => {
      const parsed = UpdateClinicStatusSchema.safeParse({ status: 'deleted' });
      expect(parsed.success).toBe(false);
    });
  });

  describe('TransferOwnershipSchema', () => {
    it('should accept valid owner UUID', () => {
      const parsed = TransferOwnershipSchema.safeParse({
        ownerId: '550e8400-e29b-41d4-a716-446655440005',
      });
      expect(parsed.success).toBe(true);
    });

    it('should reject invalid UUID format', () => {
      const parsed = TransferOwnershipSchema.safeParse({ ownerId: 'not-a-uuid' });
      expect(parsed.success).toBe(false);
    });
  });
});

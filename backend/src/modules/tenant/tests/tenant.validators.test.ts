/**
 * Tenant Validators Unit Tests
 */

import { CreateTenantSchema } from '../validators/create-tenant.validator';
import { UpdateTenantSchema } from '../validators/update-tenant.validator';
import { UpdateTenantStatusSchema } from '../validators/update-status.validator';

describe('Tenant Validators', () => {
  describe('CreateTenantSchema', () => {
    it('should pass on valid parameters', () => {
      const payload = {
        name: 'Smile Dental Clinic',
        slug: 'smile-dental',
        timezone: 'America/New_York',
        country: 'US',
        language: 'en',
        subscriptionPlan: 'premium',
        branding: { logo: 'http://example.com/logo.png' },
        metadata: { source: 'organic' },
      };

      const result = CreateTenantSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });

    it('should enforce name limits', () => {
      const payload = {
        name: '', // empty name
        slug: 'smile-dental',
      };
      const result = CreateTenantSchema.safeParse(payload);
      expect(result.success).toBe(false);

      const tooLongNamePayload = {
        name: 'a'.repeat(101),
        slug: 'smile-dental',
      };
      const tooLongResult = CreateTenantSchema.safeParse(tooLongNamePayload);
      expect(tooLongResult.success).toBe(false);
    });

    it('should validate slug pattern', () => {
      const invalidSlugs = [
        'Smile-Dental', // uppercase
        'smile_dental', // underscore
        '-smile-dental', // leading hyphen
        'smile-dental-', // trailing hyphen
        'sm', // too short
        'a'.repeat(64), // too long
      ];

      for (const slug of invalidSlugs) {
        const result = CreateTenantSchema.safeParse({ name: 'Clinic', slug });
        expect(result.success).toBe(false);
      }

      const validSlugs = [
        'smile-dental',
        'smile123',
        'smi-le-den-tal',
      ];

      for (const slug of validSlugs) {
        const result = CreateTenantSchema.safeParse({ name: 'Clinic', slug });
        expect(result.success).toBe(true);
      }
    });

    it('should validate country code format', () => {
      const payload = {
        name: 'Clinic',
        slug: 'clinic',
        country: 'usa', // lowercase/3 letter
      };
      const result = CreateTenantSchema.safeParse(payload);
      expect(result.success).toBe(false);

      const validPayload = {
        name: 'Clinic',
        slug: 'clinic',
        country: 'US',
      };
      const validResult = CreateTenantSchema.safeParse(validPayload);
      expect(validResult.success).toBe(true);
    });

    it('should validate language code format', () => {
      const payload = {
        name: 'Clinic',
        slug: 'clinic',
        language: 'EN', // uppercase
      };
      const result = CreateTenantSchema.safeParse(payload);
      expect(result.success).toBe(false);

      const validPayload = {
        name: 'Clinic',
        slug: 'clinic',
        language: 'en',
      };
      const validResult = CreateTenantSchema.safeParse(validPayload);
      expect(validResult.success).toBe(true);
    });
  });

  describe('UpdateTenantSchema', () => {
    it('should pass on valid partial payload', () => {
      const payload = {
        name: 'New Smile Clinic',
      };
      const result = UpdateTenantSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });

    it('should fail on empty updates', () => {
      const payload = {};
      const result = UpdateTenantSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });
  });

  describe('UpdateTenantStatusSchema', () => {
    it('should pass on active, suspended, archived', () => {
      const statuses = ['active', 'suspended', 'archived'];
      for (const status of statuses) {
        const result = UpdateTenantStatusSchema.safeParse({ status });
        expect(result.success).toBe(true);
      }
    });

    it('should fail on deleted or unknown status', () => {
      const resultDeleted = UpdateTenantStatusSchema.safeParse({ status: 'deleted' });
      expect(resultDeleted.success).toBe(false);

      const resultUnknown = UpdateTenantStatusSchema.safeParse({ status: 'unknown' });
      expect(resultUnknown.success).toBe(false);
    });
  });
});

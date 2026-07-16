/**
 * Create Tenant Validator Schema
 *
 * Validates request payload for tenant registration.
 */

import { z } from 'zod';
import { ALL_SUBSCRIPTION_PLANS } from '../constants/tenant.constants';

const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const COUNTRY_REGEX = /^[A-Z]{2}$/;
const LANGUAGE_REGEX = /^[a-z]{2}$/;

export const CreateTenantSchema = z.object({
  name: z
    .string({ required_error: 'Tenant name is required.' })
    .trim()
    .min(1, 'Tenant name must be at least 1 character long.')
    .max(100, 'Tenant name cannot exceed 100 characters.'),
  
  slug: z
    .string({ required_error: 'Tenant slug is required.' })
    .trim()
    .min(3, 'Tenant slug must be at least 3 characters long.')
    .max(63, 'Tenant slug cannot exceed 63 characters.')
    .regex(SLUG_REGEX, 'Slug must contain only lowercase alphanumeric characters and hyphens, and cannot start or end with a hyphen.'),

  timezone: z
    .string()
    .trim()
    .min(1, 'Timezone cannot be empty.')
    .optional(),

  country: z
    .string()
    .regex(COUNTRY_REGEX, 'Country must be a valid 2-letter uppercase ISO code.')
    .optional(),

  language: z
    .string()
    .regex(LANGUAGE_REGEX, 'Language must be a valid 2-letter lowercase ISO code.')
    .optional(),

  subscriptionPlan: z
    .enum(ALL_SUBSCRIPTION_PLANS, {
      invalid_type_error: 'Invalid subscription plan.',
    })
    .optional(),

  branding: z
    .record(z.unknown())
    .optional(),

  metadata: z
    .record(z.unknown())
    .optional(),
});

export type CreateTenantDTO = z.infer<typeof CreateTenantSchema>;

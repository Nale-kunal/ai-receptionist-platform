/**
 * Update Tenant Validator Schema
 *
 * Validates request payload for tenant modifications.
 */

import { z } from 'zod';

const COUNTRY_REGEX = /^[A-Z]{2}$/;
const LANGUAGE_REGEX = /^[a-z]{2}$/;

export const UpdateTenantSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, 'Tenant name must be at least 1 character long.')
      .max(100, 'Tenant name cannot exceed 100 characters.')
      .optional(),

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

    branding: z
      .record(z.unknown())
      .optional(),

    metadata: z
      .record(z.unknown())
      .optional(),
  })
  .refine(
    (data) => Object.keys(data).length > 0,
    'At least one field must be provided for update.',
  );

export type UpdateTenantDTO = z.infer<typeof UpdateTenantSchema>;

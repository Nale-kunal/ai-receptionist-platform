/**
 * Create Clinic Payload Validator
 */

import { z } from 'zod';

// Timezone Validation Helper
export function isValidTimezone(tz: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch (e) {
    return false;
  }
}

const TimezoneSchema = z.string().refine(isValidTimezone, {
  message: 'Invalid IANA timezone name',
});

export const CreateClinicSchema = z.object({
  ownerId: z.string().uuid('Owner ID must be a valid UUID'),
  name: z.string().min(1, 'Clinic name is required').max(100),
  legalName: z.string().max(100).nullable().optional(),
  slug: z
    .string()
    .min(3)
    .max(50)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase alphanumeric and hyphen-separated'),
  timezone: TimezoneSchema,
  country: z.string().regex(/^[A-Z]{2}$/, 'Country code must be exactly 2 uppercase letters'),
  
  primaryEmail: z.string().email('Invalid email format').nullable().optional(),
  primaryPhone: z
    .string()
    .regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number format')
    .nullable()
    .optional(),
  website: z.string().url('Invalid website URL').or(z.string().length(0)).nullable().optional(),
  address: z.string().max(255).nullable().optional(),
  city: z.string().max(100).nullable().optional(),
  state: z.string().max(100).nullable().optional(),
  postalCode: z.string().max(20).nullable().optional(),
  
  logoReference: z.string().max(255).nullable().optional(),
  brandIdentifier: z.string().max(100).nullable().optional(),
  
  subscriptionId: z.string().max(100).nullable().optional(),
  planId: z.string().max(100).nullable().optional(),
  subscriptionStatus: z.string().max(50).nullable().optional(),
});

export type CreateClinicDto = z.infer<typeof CreateClinicSchema>;

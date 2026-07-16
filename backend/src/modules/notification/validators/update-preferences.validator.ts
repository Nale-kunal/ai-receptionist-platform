/**
 * Update Patient Preferences Validator
 */

import { z } from 'zod';

export const UpdatePreferencesSchema = z.object({
  smsEnabled:             z.boolean().optional(),
  emailEnabled:           z.boolean().optional(),
  preferredLanguage:      z.string().min(2).max(10).optional(),
  preferredContactMethod: z.enum(['sms', 'email']).optional(),
}).refine(
  (data) => Object.values(data).some((v) => v !== undefined),
  { message: 'At least one preference field must be updated.' }
);

export type UpdatePreferencesDto = z.infer<typeof UpdatePreferencesSchema>;

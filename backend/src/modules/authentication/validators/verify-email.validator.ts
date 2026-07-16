/**
 * Verify Email DTO & Validator
 */

import { z } from 'zod';

export const VerifyEmailSchema = z.object({
  token: z
    .string({ required_error: 'Verification token is required.' })
    .min(1, 'Verification token is required.')
    .max(512, 'Verification token is invalid.'),
});

export type VerifyEmailDTO = z.infer<typeof VerifyEmailSchema>;

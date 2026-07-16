/**
 * Resend Verification Email DTO & Validator
 */

import { z } from 'zod';

export const ResendVerificationSchema = z.object({
  email: z
    .string({ required_error: 'Email is required.' })
    .trim()
    .toLowerCase()
    .email('A valid email address is required.')
    .max(254, 'Email must not exceed 254 characters.'),
});

export type ResendVerificationDTO = z.infer<typeof ResendVerificationSchema>;

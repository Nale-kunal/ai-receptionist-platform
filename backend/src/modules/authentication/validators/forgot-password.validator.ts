/**
 * Forgot Password DTO & Validator
 */

import { z } from 'zod';

export const ForgotPasswordSchema = z.object({
  email: z
    .string({ required_error: 'Email is required.' })
    .trim()
    .toLowerCase()
    .email('A valid email address is required.')
    .max(254, 'Email must not exceed 254 characters.'),
});

export type ForgotPasswordDTO = z.infer<typeof ForgotPasswordSchema>;

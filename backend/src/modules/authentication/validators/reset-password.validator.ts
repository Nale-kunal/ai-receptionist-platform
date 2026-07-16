/**
 * Reset Password DTO & Validator
 *
 * Enforces the same password policy as registration (contract §Password Requirements).
 */

import { z } from 'zod';
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '../constants/auth.constants';

const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]).+$/;

export const ResetPasswordSchema = z
  .object({
    token: z
      .string({ required_error: 'Reset token is required.' })
      .min(1, 'Reset token is required.')
      .max(512, 'Reset token is invalid.'),

    newPassword: z
      .string({ required_error: 'New password is required.' })
      .min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`)
      .max(PASSWORD_MAX_LENGTH, `Password must not exceed ${PASSWORD_MAX_LENGTH} characters.`)
      .regex(
        passwordRegex,
        'Password must contain at least one uppercase letter, one lowercase letter, one digit, and one special character.',
      ),

    confirmPassword: z.string({ required_error: 'Password confirmation is required.' }),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match.',
    path: ['confirmPassword'],
  });

export type ResetPasswordDTO = z.infer<typeof ResetPasswordSchema>;

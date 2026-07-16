/**
 * Registration DTO & Validator
 *
 * Zod schema that enforces every rule from the Authentication Contract:
 * - Minimum 12 characters
 * - Uppercase, lowercase, digit, special character
 * - Valid email format
 * - Name fields present
 *
 * Never trust client data. Validate at the transport boundary before
 * any service call.
 */

import { z } from 'zod';
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '../constants/auth.constants';

const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]).+$/;

export const RegisterSchema = z
  .object({
    email: z
      .string({ required_error: 'Email is required.' })
      .trim()
      .toLowerCase()
      .email('A valid email address is required.')
      .max(254, 'Email must not exceed 254 characters.'),

    password: z
      .string({ required_error: 'Password is required.' })
      .min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`)
      .max(PASSWORD_MAX_LENGTH, `Password must not exceed ${PASSWORD_MAX_LENGTH} characters.`)
      .regex(
        passwordRegex,
        'Password must contain at least one uppercase letter, one lowercase letter, one digit, and one special character.',
      ),

    confirmPassword: z.string({ required_error: 'Password confirmation is required.' }),

    firstName: z
      .string({ required_error: 'First name is required.' })
      .trim()
      .min(1, 'First name is required.')
      .max(100, 'First name must not exceed 100 characters.'),

    lastName: z
      .string({ required_error: 'Last name is required.' })
      .trim()
      .min(1, 'Last name is required.')
      .max(100, 'Last name must not exceed 100 characters.'),

    tenantId: z
      .string()
      .uuid('Tenant ID must be a valid UUID.')
      .optional(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match.',
    path: ['confirmPassword'],
  });

export type RegisterDTO = z.infer<typeof RegisterSchema>;

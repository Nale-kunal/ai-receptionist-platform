/**
 * Login DTO & Validator
 */

import { z } from 'zod';
import { PASSWORD_MAX_LENGTH } from '../constants/auth.constants';

export const LoginSchema = z.object({
  email: z
    .string({ required_error: 'Email is required.' })
    .trim()
    .toLowerCase()
    .email('A valid email address is required.')
    .max(254, 'Email must not exceed 254 characters.'),

  password: z
    .string({ required_error: 'Password is required.' })
    .min(1, 'Password is required.')
    .max(PASSWORD_MAX_LENGTH, `Password must not exceed ${PASSWORD_MAX_LENGTH} characters.`),
});

export type LoginDTO = z.infer<typeof LoginSchema>;

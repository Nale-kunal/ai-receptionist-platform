/**
 * Refresh Token DTO & Validator
 *
 * Accepts the refresh token from either the HttpOnly cookie (preferred)
 * or from the request body (fallback for non-browser clients).
 *
 * The controller extracts the token from the cookie first.
 * This validator is used when the token is passed in the body.
 */

import { z } from 'zod';

export const RefreshTokenSchema = z.object({
  refreshToken: z
    .string({ required_error: 'Refresh token is required.' })
    .min(1, 'Refresh token is required.')
    .max(512, 'Refresh token is invalid.'),
});

export type RefreshTokenDTO = z.infer<typeof RefreshTokenSchema>;

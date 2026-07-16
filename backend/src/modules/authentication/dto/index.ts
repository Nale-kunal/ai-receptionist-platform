/**
 * DTO Barrel
 *
 * Re-exports all Data Transfer Object types for convenient import.
 * These are the Zod-inferred TypeScript types used across the module.
 */

export type { RegisterDTO } from '../validators/register.validator';
export type { LoginDTO } from '../validators/login.validator';
export type { RefreshTokenDTO } from '../validators/refresh-token.validator';
export type { ForgotPasswordDTO } from '../validators/forgot-password.validator';
export type { ResetPasswordDTO } from '../validators/reset-password.validator';
export type { VerifyEmailDTO } from '../validators/verify-email.validator';
export type { ResendVerificationDTO } from '../validators/resend-verification.validator';

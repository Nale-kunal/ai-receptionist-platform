/**
 * Authentication Constants
 *
 * All authentication timing and configuration constants.
 * Values are consumed via the config layer — these are the defaults/keys.
 */

/** Access token TTL in seconds (15 minutes) */
export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;

/** Refresh token TTL in seconds (30 days) */
export const REFRESH_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60;

/** Password reset token TTL in seconds (1 hour) */
export const PASSWORD_RESET_TOKEN_TTL_SECONDS = 60 * 60;

/** Email verification token TTL in seconds (24 hours) */
export const EMAIL_VERIFICATION_TOKEN_TTL_SECONDS = 24 * 60 * 60;

/** Number of bytes for cryptographically random token generation */
export const SECURE_TOKEN_BYTES = 48;

/** Cookie name for refresh token */
export const REFRESH_TOKEN_COOKIE_NAME = 'rt';

/** Cookie name for CSRF token (future) */
export const CSRF_COOKIE_NAME = 'csrf';

/** Maximum failed login attempts before lock */
export const MAX_FAILED_LOGIN_ATTEMPTS = 10;

/** Account lock duration in seconds (15 minutes) */
export const ACCOUNT_LOCK_DURATION_SECONDS = 15 * 60;

/** Argon2id memory cost in KiB (64 MiB) */
export const ARGON2_MEMORY_COST = 65536;

/** Argon2id time cost (iterations) */
export const ARGON2_TIME_COST = 3;

/** Argon2id parallelism */
export const ARGON2_PARALLELISM = 1;

/** JWT algorithm */
export const JWT_ALGORITHM = 'HS256' as const;

/** Minimum password length (per contract) */
export const PASSWORD_MIN_LENGTH = 12;

/** Maximum password length (prevent DoS via huge bcrypt inputs) */
export const PASSWORD_MAX_LENGTH = 128;

/** Maximum request size for auth endpoints */
export const AUTH_MAX_REQUEST_BYTES = 8 * 1024; // 8 KB

/** API version prefix */
export const API_VERSION = '/api/v1';

/** Authentication route prefix */
export const AUTH_ROUTE_PREFIX = `${API_VERSION}/auth`;

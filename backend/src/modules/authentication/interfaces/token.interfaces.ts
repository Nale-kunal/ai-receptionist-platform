/**
 * Token Interfaces
 *
 * Typed JWT payload structures.
 * These define what is embedded inside signed access tokens.
 * Refresh tokens are opaque (random bytes), not JWTs.
 */

// --------------------------------------------------------------------------
// Access Token Payload
// --------------------------------------------------------------------------

/**
 * Claims embedded inside every signed access token.
 * Per the Authentication Contract:
 *   - User ID
 *   - Tenant ID
 *   - Clinic ID
 *   - Role
 *   - Token Version
 *   - Session ID
 *   - Expiration (handled by jwt library via `exp` claim)
 */
export interface AccessTokenPayload {
  /** Internal user UUID — used for lookups */
  sub: string;
  /** Tenant UUID — enforces tenant isolation */
  tenantId: string;
  /** Clinic UUID (nullable — platform admins may not belong to a clinic) */
  clinicId: string | null;
  /** Role name */
  role: string;
  /** Monotonically incremented on password change / revoke-all — invalidates older tokens */
  tokenVersion: number;
  /** Session UUID — links token to a trackable session record */
  sessionId: string;
  /** Email — included for display, not for authorization logic */
  email: string;
  /** Standard JWT issued-at claim (seconds since epoch) */
  iat?: number;
  /** Standard JWT expiration claim (seconds since epoch) */
  exp?: number;
}

// --------------------------------------------------------------------------
// Verified Access Token
// --------------------------------------------------------------------------

/**
 * The result of successfully verifying and decoding an access token.
 * Same as AccessTokenPayload but with iat and exp guaranteed present.
 */
export interface VerifiedAccessToken extends Required<AccessTokenPayload> {}

// --------------------------------------------------------------------------
// Token Metadata (for audit / session validation)
// --------------------------------------------------------------------------

export interface TokenMetadata {
  sessionId: string;
  userId: string;
  tenantId: string;
  tokenVersion: number;
  issuedAt: Date;
  expiresAt: Date;
}

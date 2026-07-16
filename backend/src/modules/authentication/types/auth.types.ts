/**
 * Authentication Types
 *
 * Shared TypeScript types used across the Authentication module.
 * These are plain data types (not classes), suitable for serialization.
 */

// --------------------------------------------------------------------------
// Authenticated User Context
// --------------------------------------------------------------------------

/**
 * Represents the verified identity attached to req.user after
 * the authenticate middleware validates a JWT.
 */
export interface AuthenticatedUser {
  userId: string;
  tenantId: string;
  clinicId: string | null;
  role: string;
  sessionId: string;
  tokenVersion: number;
  email: string;
}

// --------------------------------------------------------------------------
// Device Information
// --------------------------------------------------------------------------

/**
 * Device fingerprint extracted from the incoming HTTP request.
 * Used for session tracking per the Authentication Contract.
 */
export interface DeviceInfo {
  /** Raw User-Agent string */
  userAgent: string;
  /** Client IP address (may be from X-Forwarded-For behind a proxy) */
  ipAddress: string;
  /** Best-effort parsed browser name */
  browser: string | null;
  /** Best-effort parsed OS name */
  operatingSystem: string | null;
  /** Best-effort device type: desktop | mobile | tablet | unknown */
  deviceType: 'desktop' | 'mobile' | 'tablet' | 'unknown';
}

// --------------------------------------------------------------------------
// Session Context
// --------------------------------------------------------------------------

/**
 * Full session context returned after successful login or token refresh.
 */
export interface SessionContext {
  sessionId: string;
  userId: string;
  tenantId: string;
  createdAt: Date;
  lastActivityAt: Date;
  expiresAt: Date;
  device: DeviceInfo;
  isActive: boolean;
}

// --------------------------------------------------------------------------
// Token Pair
// --------------------------------------------------------------------------

/**
 * Returned from token-generation operations.
 * The refresh token is the raw (unhashed) opaque value — it must be
 * delivered via HttpOnly cookie only, never logged or included in API bodies.
 */
export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: Date;
  refreshTokenExpiresAt: Date;
}

// --------------------------------------------------------------------------
// Login Result
// --------------------------------------------------------------------------

/**
 * Result returned by AuthService.login() to the controller.
 * The controller is responsible for setting the cookie and returning
 * only the accessToken in the response body.
 */
export interface LoginResult {
  accessToken: string;
  accessTokenExpiresAt: Date;
  refreshToken: string;
  refreshTokenExpiresAt: Date;
  user: SafeUser;
}

// --------------------------------------------------------------------------
// Safe User (public-facing, no sensitive fields)
// --------------------------------------------------------------------------

/**
 * User data safe to include in API responses.
 * Password hashes, token versions, and internal IDs are excluded.
 */
export interface SafeUser {
  publicId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  tenantId: string;
  emailVerified: boolean;
  createdAt: Date;
}

// --------------------------------------------------------------------------
// Registration Result
// --------------------------------------------------------------------------

export interface RegistrationResult {
  user: SafeUser;
  /** Whether a verification email was dispatched */
  verificationEmailSent: boolean;
}

// --------------------------------------------------------------------------
// Password Reset Request Result
// --------------------------------------------------------------------------

/**
 * Always returned regardless of whether the email exists,
 * to prevent user enumeration.
 */
export interface PasswordResetRequestResult {
  message: string;
}

// --------------------------------------------------------------------------
// Token Refresh Result
// --------------------------------------------------------------------------

export interface TokenRefreshResult {
  accessToken: string;
  accessTokenExpiresAt: Date;
  refreshToken: string;
  refreshTokenExpiresAt: Date;
}

/**
 * Authentication Domain Errors
 *
 * All typed errors specific to the Authentication module.
 * Never throw generic Error — throw one of these typed errors instead.
 *
 * HTTP status codes are carried on the error so the global error handler
 * can map them to responses without knowing domain logic.
 */

export class AuthError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = this.constructor.name;
    // Maintains proper stack trace in V8
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

// --------------------------------------------------------------------------
// Registration Errors
// --------------------------------------------------------------------------

export class EmailAlreadyRegisteredError extends AuthError {
  constructor() {
    super('An account with this email address already exists.', 'AUTH_EMAIL_ALREADY_REGISTERED', 409);
  }
}

export class WeakPasswordError extends AuthError {
  constructor(message: string) {
    super(message, 'AUTH_WEAK_PASSWORD', 422);
  }
}

// --------------------------------------------------------------------------
// Login / Credential Errors
// --------------------------------------------------------------------------

export class InvalidCredentialsError extends AuthError {
  constructor() {
    // Deliberately vague: do not indicate whether email or password is wrong
    super('The credentials provided are invalid.', 'AUTH_INVALID_CREDENTIALS', 401);
  }
}

export class AccountLockedError extends AuthError {
  constructor(public readonly unlocksAt: Date) {
    super('This account has been temporarily locked due to repeated failed login attempts.', 'AUTH_ACCOUNT_LOCKED', 423);
  }
}

export class AccountSuspendedError extends AuthError {
  constructor() {
    super('This account has been suspended. Please contact support.', 'AUTH_ACCOUNT_SUSPENDED', 403);
  }
}

export class ClinicSuspendedError extends AuthError {
  constructor() {
    super('Clinic access is suspended. Please contact your platform administrator.', 'CLINIC_SUSPENDED', 403);
  }
}

export class AccountNotVerifiedError extends AuthError {
  constructor() {
    super('Your email address must be verified before you can log in.', 'AUTH_EMAIL_NOT_VERIFIED', 403);
  }
}

export class AccountInactiveError extends AuthError {
  constructor() {
    super('This account is inactive.', 'AUTH_ACCOUNT_INACTIVE', 403);
  }
}

// --------------------------------------------------------------------------
// Token Errors
// --------------------------------------------------------------------------

export class InvalidAccessTokenError extends AuthError {
  constructor() {
    super('The access token is invalid or has expired.', 'AUTH_INVALID_ACCESS_TOKEN', 401);
  }
}

export class InvalidRefreshTokenError extends AuthError {
  constructor() {
    super('The refresh token is invalid or has expired.', 'AUTH_INVALID_REFRESH_TOKEN', 401);
  }
}

export class RefreshTokenReuseDetectedError extends AuthError {
  constructor() {
    super(
      'A refresh token that has already been used was presented. This may indicate a security breach. All sessions have been revoked.',
      'AUTH_REFRESH_TOKEN_REUSE_DETECTED',
      401,
    );
  }
}

export class TokenVersionMismatchError extends AuthError {
  constructor() {
    super('The token is no longer valid. Please log in again.', 'AUTH_TOKEN_VERSION_MISMATCH', 401);
  }
}

// --------------------------------------------------------------------------
// Session Errors
// --------------------------------------------------------------------------

export class SessionNotFoundError extends AuthError {
  constructor() {
    super('Session not found.', 'AUTH_SESSION_NOT_FOUND', 401);
  }
}

export class SessionInactiveError extends AuthError {
  constructor() {
    super('This session is no longer active.', 'AUTH_SESSION_INACTIVE', 401);
  }
}

export class SessionExpiredError extends AuthError {
  constructor() {
    super('This session has expired. Please log in again.', 'AUTH_SESSION_EXPIRED', 401);
  }
}

// --------------------------------------------------------------------------
// Password Reset Errors
// --------------------------------------------------------------------------

export class InvalidPasswordResetTokenError extends AuthError {
  constructor() {
    super('The password reset link is invalid or has expired.', 'AUTH_INVALID_RESET_TOKEN', 400);
  }
}

export class PasswordResetTokenAlreadyUsedError extends AuthError {
  constructor() {
    super('This password reset link has already been used.', 'AUTH_RESET_TOKEN_USED', 400);
  }
}

// --------------------------------------------------------------------------
// Email Verification Errors
// --------------------------------------------------------------------------

export class InvalidVerificationTokenError extends AuthError {
  constructor() {
    super('The email verification link is invalid or has expired.', 'AUTH_INVALID_VERIFICATION_TOKEN', 400);
  }
}

export class EmailAlreadyVerifiedError extends AuthError {
  constructor() {
    super('This email address has already been verified.', 'AUTH_EMAIL_ALREADY_VERIFIED', 409);
  }
}

// --------------------------------------------------------------------------
// User Not Found
// --------------------------------------------------------------------------

export class UserNotFoundError extends AuthError {
  constructor() {
    // Vague by design: prevents user enumeration
    super('The credentials provided are invalid.', 'AUTH_USER_NOT_FOUND', 401);
  }
}

// --------------------------------------------------------------------------
// Tenant Errors
// --------------------------------------------------------------------------

export class TenantNotFoundError extends AuthError {
  constructor() {
    super('Tenant not found or inactive.', 'AUTH_TENANT_NOT_FOUND', 403);
  }
}

export class TenantMismatchError extends AuthError {
  constructor() {
    super('Tenant context does not match authenticated user.', 'AUTH_TENANT_MISMATCH', 403);
  }
}

// --------------------------------------------------------------------------
// Configuration / Secret Errors (startup-only)
// --------------------------------------------------------------------------

export class MissingJwtSecretError extends AuthError {
  constructor(key: string) {
    super(`Required JWT secret "${key}" is not configured.`, 'AUTH_MISSING_JWT_SECRET', 500);
  }
}

// --------------------------------------------------------------------------
// Invitation Errors
// --------------------------------------------------------------------------

export class InvitationAlreadyMemberError extends AuthError {
  constructor(email: string) {
    super(
      `A user with email '${email}' is already a member of this practice.`,
      'USER_ALREADY_MEMBER',
      409,
    );
  }
}

export class InvitationAlreadyRegisteredError extends AuthError {
  constructor(email: string) {
    super(
      `A user with email '${email}' is already registered on the platform.`,
      'USER_ALREADY_REGISTERED',
      409,
    );
  }
}

export class InvitationPendingExistsError extends AuthError {
  constructor(email: string) {
    super(
      `A pending invitation already exists for '${email}'. Revoke the existing invitation before creating a new one.`,
      'INVITATION_ALREADY_EXISTS',
      409,
    );
  }
}

export class InvitationAlreadyAcceptedError extends AuthError {
  constructor() {
    super('This invitation token has already been used.', 'INVITATION_ALREADY_ACCEPTED', 409);
  }
}

export class InvitationRevokedError extends AuthError {
  constructor() {
    super('This invitation has been revoked by the Practice Owner.', 'INVITATION_REVOKED', 410);
  }
}

export class InvitationExpiredError extends AuthError {
  constructor() {
    super('This invitation link has expired. Please ask your Practice Owner for a new invitation.', 'INVITATION_EXPIRED', 410);
  }
}

export class InvitationInvalidTokenError extends AuthError {
  constructor(message = 'Invalid invitation token.') {
    super(message, 'INVALID_INVITATION_TOKEN', 400);
  }
}

export class InvitationInvalidRoleError extends AuthError {
  constructor(role: string) {
    super(
      `Invalid role '${role}'. Allowed roles are: Practice Owner (clinic_owner), Dentist (doctor), Receptionist (receptionist).`,
      'INVALID_INVITATION_ROLE',
      422,
    );
  }
}

export class InvitationActorInactiveError extends AuthError {
  constructor() {
    super('Inviting user is not an active member of this practice.', 'INVITATION_ACTOR_INACTIVE', 403);
  }
}


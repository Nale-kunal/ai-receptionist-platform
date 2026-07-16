/**
 * Authentication Domain Events
 *
 * Immutable event value objects emitted by AuthService.
 * Consumers (audit logger, notification service, etc.) listen to these events.
 *
 * Events describe completed facts — they are never commands.
 * Per Engineering Constitution Principle 14.
 */

import type { DeviceInfo } from '../types/auth.types';

// --------------------------------------------------------------------------
// Base Event
// --------------------------------------------------------------------------

interface BaseAuthEvent {
  readonly eventType: string;
  readonly occurredAt: Date;
  readonly requestId: string;
  readonly tenantId: string | null;
  readonly userId: string | null;
  readonly ipAddress: string;
}

// --------------------------------------------------------------------------
// User Registered
// --------------------------------------------------------------------------

export interface UserRegisteredEvent extends BaseAuthEvent {
  readonly eventType: 'auth.user.registered';
  readonly userId: string;
  readonly tenantId: string;
  readonly email: string;
  readonly deviceInfo: DeviceInfo;
}

// --------------------------------------------------------------------------
// Login Success
// --------------------------------------------------------------------------

export interface UserLoggedInEvent extends BaseAuthEvent {
  readonly eventType: 'auth.user.login.success';
  readonly userId: string;
  readonly tenantId: string;
  readonly sessionId: string;
  readonly deviceInfo: DeviceInfo;
}

// --------------------------------------------------------------------------
// Login Failed
// --------------------------------------------------------------------------

export interface UserLoginFailedEvent extends BaseAuthEvent {
  readonly eventType: 'auth.user.login.failed';
  /** Deliberately vague — do not log whether failure was email or password */
  readonly reason: 'invalid_credentials' | 'account_locked' | 'account_suspended' | 'account_inactive' | 'email_not_verified';
  readonly deviceInfo: DeviceInfo;
}

// --------------------------------------------------------------------------
// Logout
// --------------------------------------------------------------------------

export interface UserLoggedOutEvent extends BaseAuthEvent {
  readonly eventType: 'auth.user.logout';
  readonly userId: string;
  readonly tenantId: string;
  readonly sessionId: string;
}

// --------------------------------------------------------------------------
// Token Refreshed
// --------------------------------------------------------------------------

export interface TokenRefreshedEvent extends BaseAuthEvent {
  readonly eventType: 'auth.token.refreshed';
  readonly userId: string;
  readonly tenantId: string;
  readonly sessionId: string;
}

// --------------------------------------------------------------------------
// Refresh Token Reuse Detected
// --------------------------------------------------------------------------

export interface RefreshTokenReuseDetectedEvent extends BaseAuthEvent {
  readonly eventType: 'auth.token.reuse_detected';
  readonly userId: string | null;
  readonly tenantId: string | null;
  readonly sessionId: string | null;
  readonly deviceInfo: DeviceInfo;
}

// --------------------------------------------------------------------------
// Session Revoked
// --------------------------------------------------------------------------

export interface SessionRevokedEvent extends BaseAuthEvent {
  readonly eventType: 'auth.session.revoked';
  readonly userId: string;
  readonly tenantId: string;
  readonly sessionId: string;
  readonly reason: 'logout' | 'password_reset' | 'admin' | 'token_reuse' | 'expired';
}

// --------------------------------------------------------------------------
// All Sessions Revoked
// --------------------------------------------------------------------------

export interface AllSessionsRevokedEvent extends BaseAuthEvent {
  readonly eventType: 'auth.session.all_revoked';
  readonly userId: string;
  readonly tenantId: string;
  readonly reason: 'password_reset' | 'admin' | 'security_incident';
}

// --------------------------------------------------------------------------
// Password Reset Requested
// --------------------------------------------------------------------------

export interface PasswordResetRequestedEvent extends BaseAuthEvent {
  readonly eventType: 'auth.password.reset_requested';
  readonly userId: string;
  readonly tenantId: string;
}

// --------------------------------------------------------------------------
// Password Reset Completed
// --------------------------------------------------------------------------

export interface PasswordResetCompletedEvent extends BaseAuthEvent {
  readonly eventType: 'auth.password.reset_completed';
  readonly userId: string;
  readonly tenantId: string;
}

// --------------------------------------------------------------------------
// Email Verification Sent
// --------------------------------------------------------------------------

export interface EmailVerificationSentEvent extends BaseAuthEvent {
  readonly eventType: 'auth.email.verification_sent';
  readonly userId: string;
  readonly tenantId: string;
}

// --------------------------------------------------------------------------
// Email Verified
// --------------------------------------------------------------------------

export interface EmailVerifiedEvent extends BaseAuthEvent {
  readonly eventType: 'auth.email.verified';
  readonly userId: string;
  readonly tenantId: string;
}

// --------------------------------------------------------------------------
// Account Locked
// --------------------------------------------------------------------------

export interface AccountLockedEvent extends BaseAuthEvent {
  readonly eventType: 'auth.account.locked';
  readonly userId: string;
  readonly tenantId: string;
  readonly unlocksAt: Date;
  readonly failedAttempts: number;
  readonly deviceInfo: DeviceInfo;
}

// --------------------------------------------------------------------------
// Union Type
// --------------------------------------------------------------------------

export type AuthDomainEvent =
  | UserRegisteredEvent
  | UserLoggedInEvent
  | UserLoginFailedEvent
  | UserLoggedOutEvent
  | TokenRefreshedEvent
  | RefreshTokenReuseDetectedEvent
  | SessionRevokedEvent
  | AllSessionsRevokedEvent
  | PasswordResetRequestedEvent
  | PasswordResetCompletedEvent
  | EmailVerificationSentEvent
  | EmailVerifiedEvent
  | AccountLockedEvent;

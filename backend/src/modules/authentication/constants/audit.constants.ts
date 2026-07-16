/**
 * Audit Event Constants
 *
 * Immutable audit event type strings for the Authentication module.
 * These are the canonical event identifiers written to the audit log.
 */

export const AUTH_AUDIT_EVENTS = {
  USER_REGISTERED: 'auth.user.registered',
  USER_LOGIN_SUCCESS: 'auth.user.login.success',
  USER_LOGIN_FAILED: 'auth.user.login.failed',
  USER_LOGOUT: 'auth.user.logout',
  TOKEN_REFRESHED: 'auth.token.refreshed',
  TOKEN_REUSE_DETECTED: 'auth.token.reuse_detected',
  SESSION_REVOKED: 'auth.session.revoked',
  ALL_SESSIONS_REVOKED: 'auth.session.all_revoked',
  PASSWORD_RESET_REQUESTED: 'auth.password.reset_requested',
  PASSWORD_RESET_COMPLETED: 'auth.password.reset_completed',
  PASSWORD_CHANGED: 'auth.password.changed',
  EMAIL_VERIFICATION_SENT: 'auth.email.verification_sent',
  EMAIL_VERIFIED: 'auth.email.verified',
  ACCOUNT_LOCKED: 'auth.account.locked',
  ACCOUNT_UNLOCKED: 'auth.account.unlocked',
} as const;

export type AuthAuditEvent = (typeof AUTH_AUDIT_EVENTS)[keyof typeof AUTH_AUDIT_EVENTS];

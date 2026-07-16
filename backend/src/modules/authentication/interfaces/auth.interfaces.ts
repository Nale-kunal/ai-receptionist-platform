/**
 * Authentication Service Interfaces
 *
 * Defines the public contracts for AuthService, TokenService, and SessionService.
 * Modules outside Authentication interact with these interfaces, not concrete classes.
 * This supports future provider substitution without changing callers.
 */

import type {
  LoginResult,
  RegistrationResult,
  TokenRefreshResult,
  PasswordResetRequestResult,
  SafeUser,
  DeviceInfo,
  SessionContext,
  TokenPair,
} from '../types/auth.types';

import type { AccessTokenPayload, VerifiedAccessToken } from './token.interfaces';

// --------------------------------------------------------------------------
// IAuthService
// --------------------------------------------------------------------------

/**
 * Primary authentication service contract.
 * Services implement business logic only — no HTTP, no cookies.
 */
export interface IAuthService {
  register(params: RegisterParams): Promise<RegistrationResult>;

  login(params: LoginParams): Promise<LoginResult>;

  logout(params: LogoutParams): Promise<void>;

  refreshTokens(params: RefreshTokenParams): Promise<TokenRefreshResult>;

  forgotPassword(params: ForgotPasswordParams): Promise<PasswordResetRequestResult>;

  resetPassword(params: ResetPasswordParams): Promise<void>;

  verifyEmail(params: VerifyEmailParams): Promise<SafeUser>;

  resendVerificationEmail(params: ResendVerificationParams): Promise<void>;
}

// --------------------------------------------------------------------------
// ITokenService
// --------------------------------------------------------------------------

/**
 * JWT and refresh token operations.
 * Separated from AuthService because token concerns are orthogonal to
 * business registration / login flows and need to be independently testable.
 */
export interface ITokenService {
  signAccessToken(payload: AccessTokenPayload): string;

  verifyAccessToken(token: string): VerifiedAccessToken;

  generateRefreshToken(): string;

  hashRefreshToken(rawToken: string): string;

  generateSecureToken(): string;

  hashSecureToken(rawToken: string): string;

  buildTokenPair(payload: AccessTokenPayload): TokenPair;
}

// --------------------------------------------------------------------------
// ISessionService
// --------------------------------------------------------------------------

/**
 * Session lifecycle management.
 */
export interface ISessionService {
  createSession(params: CreateSessionParams): Promise<SessionContext>;

  getSession(sessionId: string): Promise<SessionContext | null>;

  updateSessionActivity(sessionId: string): Promise<void>;

  revokeSession(sessionId: string): Promise<void>;

  revokeAllUserSessions(userId: string): Promise<void>;

  getUserActiveSessions(userId: string): Promise<SessionContext[]>;
}

// --------------------------------------------------------------------------
// Parameter Types
// --------------------------------------------------------------------------

export interface RegisterParams {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  tenantId?: string;
  requestId: string;
  deviceInfo: DeviceInfo;
}

export interface LoginParams {
  email: string;
  password: string;
  deviceInfo: DeviceInfo;
  requestId: string;
}

export interface LogoutParams {
  userId: string;
  sessionId: string;
  requestId: string;
}

export interface RefreshTokenParams {
  rawRefreshToken: string;
  sessionId: string;
  requestId: string;
  deviceInfo: DeviceInfo;
}

export interface ForgotPasswordParams {
  email: string;
  requestId: string;
  deviceInfo: DeviceInfo;
}

export interface ResetPasswordParams {
  token: string;
  newPassword: string;
  requestId: string;
}

export interface VerifyEmailParams {
  token: string;
  requestId: string;
}

export interface ResendVerificationParams {
  email: string;
  requestId: string;
}

export interface CreateSessionParams {
  userId: string;
  tenantId: string;
  refreshTokenHash: string;
  deviceInfo: DeviceInfo;
  expiresAt: Date;
}

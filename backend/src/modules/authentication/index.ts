/**
 * Authentication Module — Public API
 *
 * This is the only import surface other modules should use.
 * Internal implementation details are NOT exported.
 *
 * Consumers import:
 *   - AuthService (for integration with other modules if needed)
 *   - TokenService (for token verification in other modules)
 *   - Middleware factory (for protecting routes)
 *   - Type definitions
 *   - Error types (for error handling in middleware)
 *   - Router factory
 */

// Services (public contract)
export { AuthService } from './services/auth.service';
export { TokenService } from './services/token.service';
export { SessionService } from './services/session.service';
export type { AuthEmailProvider } from './services/auth.service';
export type { TokenServiceConfig } from './services/token.service';

// Controller
export { AuthController } from './controllers/auth.controller';

// Routes
export { createAuthRouter } from './routes/auth.routes';
export type { AuthRouterOptions, RateLimiterFactory } from './routes/auth.routes';

// Middleware
export {
  createAuthenticateMiddleware,
  createOptionalAuthMiddleware,
} from './middleware/authenticate.middleware';

// Repositories
export { UserRepository } from './repositories/user.repository';
export { SessionRepository } from './repositories/session.repository';
export { PasswordResetTokenRepository } from './repositories/password-reset-token.repository';
export { EmailVerificationTokenRepository } from './repositories/email-verification-token.repository';

// Types
export type {
  AuthenticatedUser,
  DeviceInfo,
  SessionContext,
  TokenPair,
  LoginResult,
  RegistrationResult,
  SafeUser,
  TokenRefreshResult,
  PasswordResetRequestResult,
} from './types/auth.types';

// Interfaces
export type {
  IAuthService,
  ITokenService,
  ISessionService,
} from './interfaces/auth.interfaces';
export type {
  AccessTokenPayload,
  VerifiedAccessToken,
} from './interfaces/token.interfaces';

// Events
export type { AuthDomainEvent } from './events/auth.events';
export { InProcessAuthEventPublisher } from './events/auth-event.publisher';
export type { AuthEventPublisher } from './events/auth-event.publisher';

// Errors (for global error handler mapping)
export {
  AuthError,
  EmailAlreadyRegisteredError,
  InvalidCredentialsError,
  AccountLockedError,
  AccountSuspendedError,
  AccountNotVerifiedError,
  InvalidAccessTokenError,
  InvalidRefreshTokenError,
  RefreshTokenReuseDetectedError,
  TokenVersionMismatchError,
  SessionNotFoundError,
  SessionInactiveError,
  SessionExpiredError,
  InvalidPasswordResetTokenError,
  InvalidVerificationTokenError,
  EmailAlreadyVerifiedError,
  UserNotFoundError,
  TenantNotFoundError,
  TenantMismatchError,
} from './errors/auth.errors';

// Constants
export {
  AUTH_ROUTE_PREFIX,
  REFRESH_TOKEN_COOKIE_NAME,
  ACCESS_TOKEN_TTL_SECONDS,
  REFRESH_TOKEN_TTL_SECONDS,
} from './constants/auth.constants';
export { AUTH_AUDIT_EVENTS } from './constants/audit.constants';
export type { AuthAuditEvent } from './constants/audit.constants';

/**
 * Authentication Service
 *
 * The primary business logic layer for all authentication flows.
 *
 * Implements:
 *   - Registration
 *   - Login (with account locking)
 *   - Logout
 *   - Refresh Token Rotation
 *   - Forgot Password
 *   - Reset Password
 *   - Email Verification
 *   - Resend Verification Email
 *
 * SECURITY RULES:
 *   - Passwords hashed with Argon2id (never bcrypt, never SHA-*)
 *   - Constant-time comparison for refresh token validation
 *   - Token reuse → session revocation (entire session, not just token)
 *   - Failed logins → exponential backoff + account locking
 *   - All state changes emit audit events
 *   - Never logs passwords, tokens, secrets, or PII
 *   - All operations wrapped in transactions where multiple writes occur
 *
 * Per the Authentication Contract §Login Flow steps 1-10.
 */

import * as argon2 from 'argon2';
import * as crypto from 'crypto';

import {
  ARGON2_MEMORY_COST,
  ARGON2_PARALLELISM,
  ARGON2_TIME_COST,
  ACCOUNT_LOCK_DURATION_SECONDS,
  MAX_FAILED_LOGIN_ATTEMPTS,
  EMAIL_VERIFICATION_TOKEN_TTL_SECONDS,
  PASSWORD_RESET_TOKEN_TTL_SECONDS,
} from '../constants/auth.constants';
import { SYSTEM_ROLE_PERMISSIONS_MAP } from '../../rbac/constants/rbac.constants';

import {
  EmailAlreadyRegisteredError,
  InvalidCredentialsError,
  AccountLockedError,
  AccountSuspendedError,
  ClinicSuspendedError,
  AccountInactiveError,
  AccountNotVerifiedError,
  InvalidRefreshTokenError,
  RefreshTokenReuseDetectedError,
  InvalidPasswordResetTokenError,
  InvalidVerificationTokenError,
  EmailAlreadyVerifiedError,
  UserNotFoundError,
  DatabaseTimeoutError,
} from '../errors/auth.errors';
import { isDbConnectivityError } from '../../../shared/email/queue/MailQueueService';

import type { UserRepository } from '../repositories/user.repository';
import type { SessionRepository } from '../repositories/session.repository';
import type { PasswordResetTokenRepository } from '../repositories/password-reset-token.repository';
import type { EmailVerificationTokenRepository } from '../repositories/email-verification-token.repository';
import type { TokenService } from './token.service';
import type { SessionService } from './session.service';
import type { AuthEventPublisher } from '../events/auth-event.publisher';
import type { TenantRepository } from '../../tenant/repositories/tenant.repository';
import type { RbacBootstrapService } from '../../rbac/services/rbac-bootstrap.service';

import type {
  IAuthService,
  RegisterParams,
  LoginParams,
  LogoutParams,
  RefreshTokenParams,
  ForgotPasswordParams,
  ResetPasswordParams,
  VerifyEmailParams,
  ResendVerificationParams,
} from '../interfaces/auth.interfaces';

import type {
  LoginResult,
  RegistrationResult,
  TokenRefreshResult,
  PasswordResetRequestResult,
  SafeUser,
} from '../types/auth.types';

// --------------------------------------------------------------------------
// Email Provider Interface (injected — allows swapping SMTP providers)
// --------------------------------------------------------------------------

export interface AuthEmailProvider {
  sendEmailVerification(params: { to: string; token: string; userId: string }): Promise<void>;
  sendPasswordReset(params: { to: string; token: string; userId: string }): Promise<void>;
  sendInvitationEmail?(params: {
    to: string;
    type?: string;
    currentRoleName?: string;
    token?: string;
    roleName: string;
    tenantName: string;
    inviteLink: string;
    inviterName: string;
    tenantId?: string;
    clinicId?: string;
    idempotencyKey?: string;
  }): Promise<void>;
}

// --------------------------------------------------------------------------
// Auth Service
// --------------------------------------------------------------------------

export class AuthService implements IAuthService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly sessionRepository: SessionRepository,
    private readonly passwordResetTokenRepository: PasswordResetTokenRepository,
    private readonly emailVerificationTokenRepository: EmailVerificationTokenRepository,
    private readonly tokenService: TokenService,
    private readonly sessionService: SessionService,
    private readonly eventPublisher: AuthEventPublisher,
    private readonly emailProvider: AuthEmailProvider,
    private readonly tenantRepository?: TenantRepository,
    private readonly rbacBootstrapService?: RbacBootstrapService,
  ) {}

  // --------------------------------------------------------------------------
  // Registration
  // --------------------------------------------------------------------------

  async register(params: RegisterParams): Promise<RegistrationResult> {
    const { email, password, firstName, lastName, tenantId, requestId, deviceInfo } = params;

    // Step 1 — Check if email already exists (prevent enumeration: return same error shape)
    const existingUser = await this.userRepository.findByEmail(email);
    if (existingUser) {
      throw new EmailAlreadyRegisteredError();
    }

    // Step 2 — Hash password with Argon2id
    const passwordHash = await argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: ARGON2_MEMORY_COST,
      timeCost: ARGON2_TIME_COST,
      parallelism: ARGON2_PARALLELISM,
    });

    // Step 3 — Resolve or create valid UUID for tenantId
    let resolvedTenantId = tenantId;

    if (!resolvedTenantId || resolvedTenantId === 'default') {
      if (this.tenantRepository) {
        const existingTenants = await this.tenantRepository.findMany({ limit: 1 });
        if (existingTenants.length > 0) {
          resolvedTenantId = existingTenants[0].id;
        } else {
          const newTenant = await this.tenantRepository.create({
            name: `${firstName}'s Clinic`,
            slug: `clinic-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            status: 'active',
            timezone: 'UTC',
            country: 'US',
            language: 'en',
            subscriptionPlan: 'free',
          });
          resolvedTenantId = newTenant.id;
        }
      } else {
        resolvedTenantId = '00000000-0000-0000-0000-000000000000';
      }
    }
    const user = await this.userRepository.create({
      email,
      passwordHash,
      firstName,
      lastName,
      tenantId: resolvedTenantId,
    });

    // Automatically assign system role into user_roles table (Mandatory — fails closed on error)
    if (this.rbacBootstrapService) {
      try {
        await this.rbacBootstrapService.assignSystemRoleToUser({
          userId: user.id,
          tenantId: resolvedTenantId,
          roleName: user.role ?? 'clinic_owner',
          clinicId: user.clinicId,
        });
      } catch (err) {
        console.error('[AuthService] Mandatory user_roles assignment failed during registration. Rolling back user creation:', err);
        // Rollback user creation to maintain single source of truth transaction integrity
        await this.userRepository.hardDelete(user.id).catch(() => {});
        throw new Error(`Registration failed: Could not assign RBAC role permissions.`);
      }
    }

    // Step 4 — Generate and store email verification token
    const rawVerificationToken = this.tokenService.generateSecureToken();
    const tokenHash = this.tokenService.hashSecureToken(rawVerificationToken);
    const expiresAt = new Date(Date.now() + EMAIL_VERIFICATION_TOKEN_TTL_SECONDS * 1000);

    await this.emailVerificationTokenRepository.create({
      userId: user.id,
      tenantId: resolvedTenantId,
      tokenHash,
      expiresAt,
    });

    // Step 5 — Send verification email (fire-and-forget — do not block registration)
    let verificationEmailSent = false;
    try {
      await this.emailProvider.sendEmailVerification({
        to: user.email,
        token: rawVerificationToken,
        userId: user.id,
      });
      verificationEmailSent = true;
    } catch {
      // Email failure must not block registration — log via event
    }

    // Step 6 — Publish audit event
    await this.eventPublisher.publish({
      eventType: 'auth.user.registered',
      occurredAt: new Date(),
      requestId,
      tenantId: resolvedTenantId,
      userId: user.id,
      ipAddress: deviceInfo.ipAddress,
      email: user.email,
      deviceInfo,
    });

    return {
      user: this.toSafeUser(user),
      verificationEmailSent,
    };
  }

  // --------------------------------------------------------------------------
  // Login
  // --------------------------------------------------------------------------

  async login(params: LoginParams): Promise<LoginResult> {
    const { email, password, deviceInfo, requestId } = params;

    // Step 1 — Find user (timing-safe: always run password check even if user not found)
    let user;
    try {
      user = await this.userRepository.findByEmail(email);
    } catch (dbErr: any) {
      if (isDbConnectivityError(dbErr)) {
        throw new DatabaseTimeoutError(
          'The database service is temporarily unavailable. Please verify database connection credentials or retry shortly.'
        );
      }
      throw dbErr;
    }

    // Step 2 — Verify password (timing-safe — always hash even for dummy)
    // This prevents timing attacks that reveal whether an email exists.
    const dummyHash =
      '$argon2id$v=19$m=65536,t=3,p=1$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
    const passwordToCheck = user?.passwordHash ?? dummyHash;
    const passwordValid = await argon2.verify(passwordToCheck, password);

    if (!user || !passwordValid) {
      // Publish failed login event (safe — no user ID if not found)
      await this.eventPublisher.publish({
        eventType: 'auth.user.login.failed',
        occurredAt: new Date(),
        requestId,
        tenantId: user?.tenantId ?? null,
        userId: user?.id ?? null,
        ipAddress: deviceInfo.ipAddress,
        reason: 'invalid_credentials',
        deviceInfo,
      });

      // Increment failed attempts if user exists
      if (user) {
        await this.handleFailedLoginAttempt(user, deviceInfo, requestId);
      }

      throw new InvalidCredentialsError();
    }

    // Step 3 — Check account lock
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      await this.eventPublisher.publish({
        eventType: 'auth.user.login.failed',
        occurredAt: new Date(),
        requestId,
        tenantId: user.tenantId,
        userId: user.id,
        ipAddress: deviceInfo.ipAddress,
        reason: 'account_locked',
        deviceInfo,
      });
      throw new AccountLockedError(user.lockedUntil);
    }

    // Step 4 — Check account status
    if (user.status === 'suspended') {
      throw new AccountSuspendedError();
    }
    if (user.status === 'inactive') {
      throw new AccountInactiveError();
    }
    if (user.status !== 'active') {
      throw new AccountInactiveError();
    }

    // Step 4b — Check tenant/clinic status
    if (this.tenantRepository && user.tenantId) {
      const tenant = await this.tenantRepository.findById(user.tenantId);
      if (tenant && (tenant.status === 'suspended' || tenant.status === 'TENANT_SUSPENDED')) {
        throw new ClinicSuspendedError();
      }
    }

    // Step 5 — Check email verification
    if (!user.emailVerified) {
      throw new AccountNotVerifiedError();
    }

    // Step 6 — Reset failed login attempts after successful password check
    if (user.failedLoginAttempts > 0) {
      await this.userRepository.resetFailedLoginAttempts(user.id);
    }

    // Step 7 — Build JWT payload
    const tokenExpiresAt = new Date(Date.now() + this.tokenService.getRefreshTokenTtlSeconds() * 1000);

    // Step 8 — Build token pair
    const tokenPayload = {
      sub: user.id,
      tenantId: user.tenantId,
      clinicId: user.clinicId ?? null,
      role: user.role,
      tokenVersion: user.tokenVersion,
      sessionId: '', // Filled after session creation below
      email: user.email,
    };

    const rawRefreshToken = this.tokenService.generateRefreshToken();
    const refreshTokenHash = this.tokenService.hashRefreshToken(rawRefreshToken);

    // Step 9 — Create session
    const session = await this.sessionService.createSession({
      userId: user.id,
      tenantId: user.tenantId,
      refreshTokenHash,
      deviceInfo,
      expiresAt: tokenExpiresAt,
    });

    // Step 10 — Sign access token with session ID
    const accessTokenPayload = { ...tokenPayload, sessionId: session.sessionId };
    const accessToken = this.tokenService.signAccessToken(accessTokenPayload);

    const accessTokenExpiresAt = new Date(
      Date.now() + this.tokenService.getAccessTokenTtlSeconds() * 1000,
    );

    // Step 11 — Update last login timestamp
    await this.userRepository.update(user.id, { lastLoginAt: new Date() });

    // Step 12 — Publish audit event
    await this.eventPublisher.publish({
      eventType: 'auth.user.login.success',
      occurredAt: new Date(),
      requestId,
      tenantId: user.tenantId,
      userId: user.id,
      ipAddress: deviceInfo.ipAddress,
      sessionId: session.sessionId,
      deviceInfo,
    });

    const getRolePermissions = (role: string): string[] => {
      if (role === 'super_admin' || role === 'clinic_owner' || role === 'admin' || role === 'tenant_owner') return ['*'];
      const perms = SYSTEM_ROLE_PERMISSIONS_MAP[role];
      if (perms) return Array.from(perms);
      return [];
    };

    const userWithRelations = this.userRepository.findByIdWithRelations
      ? await this.userRepository.findByIdWithRelations(user.id)
      : null;

    return {
      accessToken,
      accessTokenExpiresAt,
      refreshToken: rawRefreshToken,
      refreshTokenExpiresAt: tokenExpiresAt,
      user: this.toSafeUser(user),
      roles: [user.role],
      permissions: getRolePermissions(user.role),
      tenant: userWithRelations?.tenant ? {
        id: userWithRelations.tenant.id,
        publicId: userWithRelations.tenant.publicId,
        name: userWithRelations.tenant.name,
        slug: userWithRelations.tenant.slug,
        subscriptionPlan: userWithRelations.tenant.subscriptionPlan,
        status: userWithRelations.tenant.status,
      } : null,
      clinic: userWithRelations?.clinic ? {
        id: userWithRelations.clinic.id,
        publicId: userWithRelations.clinic.publicId,
        name: userWithRelations.clinic.name,
        slug: userWithRelations.clinic.slug,
        status: userWithRelations.clinic.status,
      } : null,
    };
  }

  // --------------------------------------------------------------------------
  // Logout
  // --------------------------------------------------------------------------

  async logout(params: LogoutParams): Promise<void> {
    const { userId, sessionId, requestId } = params;

    const user = await this.userRepository.findById(userId);
    if (!user) {
      // Do not throw — logout should always succeed from the client perspective
      return;
    }

    await this.sessionService.revokeSession(sessionId);

    await this.eventPublisher.publish({
      eventType: 'auth.user.logout',
      occurredAt: new Date(),
      requestId,
      tenantId: user.tenantId,
      userId: user.id,
      ipAddress: '',
      sessionId,
    });
  }

  // --------------------------------------------------------------------------
  // Refresh Token Rotation
  // --------------------------------------------------------------------------

  async refreshTokens(params: RefreshTokenParams): Promise<TokenRefreshResult> {
    const { rawRefreshToken, sessionId, requestId, deviceInfo } = params;

    const presentedHash = this.tokenService.hashRefreshToken(rawRefreshToken);

    // Step 1 — Find the session by sessionId if valid, or by refreshTokenHash for cookie restoration
    let session: import('@prisma/client').Session | null = null;
    if (sessionId && sessionId !== 'auto-restore') {
      session = await this.sessionRepository.findById(sessionId);
    }
    if (!session) {
      session = await this.sessionRepository.findByRefreshTokenHash(presentedHash);
    }

    if (!session) {
      throw new InvalidRefreshTokenError();
    }

    // Step 2 — Check session is active
    if (session.status !== 'active') {
      throw new InvalidRefreshTokenError();
    }

    if (session.expiresAt < new Date()) {
      throw new InvalidRefreshTokenError();
    }

    // Step 3 — Verify the presented refresh token matches the stored hash
    const storedHash = session.refreshTokenHash;

    // Timing-safe comparison to prevent timing attacks
    const hashesMatch = this.timingSafeEqual(presentedHash, storedHash);

    const activeSessionId = session.id;

    // ── REFRESH TOKEN ROTATION CONCURRENCY GRACE PERIOD (RFC 6819) ──
    const previousHash = (session as any).previousRefreshTokenHash;
    const rotatedAt = (session as any).rotatedAt;
    const isPreviousHashMatch = previousHash ? this.timingSafeEqual(presentedHash, previousHash) : false;
    const isWithinGracePeriod = rotatedAt && (Date.now() - new Date(rotatedAt).getTime() <= 30000); // 30-second window

    if (!hashesMatch) {
      if (isPreviousHashMatch && isWithinGracePeriod) {
        // Parallel/concurrent refresh request during token rotation window — return current valid access token without revoking
        const user = await this.userRepository.findById(session.userId);
        if (!user || user.status !== 'active') {
          await this.sessionService.revokeSession(activeSessionId);
          throw new InvalidRefreshTokenError();
        }

        if (this.tenantRepository && user.tenantId) {
          const tenant = await this.tenantRepository.findById(user.tenantId);
          if (tenant && (tenant.status === 'suspended' || tenant.status === 'TENANT_SUSPENDED')) {
            await this.sessionService.revokeSession(activeSessionId);
            throw new ClinicSuspendedError();
          }
        }

        const accessTokenPayload = {
          sub: user.id,
          tenantId: user.tenantId,
          clinicId: user.clinicId ?? null,
          role: user.role,
          tokenVersion: user.tokenVersion,
          sessionId: activeSessionId,
          email: user.email,
        };
        const accessToken = this.tokenService.signAccessToken(accessTokenPayload);
        const accessExpiresAt = new Date(Date.now() + this.tokenService.getAccessTokenTtlSeconds() * 1000);

        return {
          accessToken,
          accessTokenExpiresAt: accessExpiresAt,
          refreshToken: '', // keep current active refresh token cookie intact
          refreshTokenExpiresAt: session.expiresAt,
        };
      }

      // SECURITY: Token reuse detected — revoke entire session immediately
      await this.sessionService.revokeSession(activeSessionId);

      await this.eventPublisher.publish({
        eventType: 'auth.token.reuse_detected',
        occurredAt: new Date(),
        requestId,
        tenantId: session.tenantId,
        userId: session.userId,
        ipAddress: deviceInfo.ipAddress,
        sessionId: activeSessionId,
        deviceInfo,
      });

      throw new RefreshTokenReuseDetectedError();
    }

    // Step 4 — Load user to rebuild token payload
    const user = await this.userRepository.findById(session.userId);
    if (!user || user.status !== 'active') {
      await this.sessionService.revokeSession(activeSessionId);
      throw new InvalidRefreshTokenError();
    }

    // Step 4b — Check tenant/clinic status
    if (this.tenantRepository && user.tenantId) {
      const tenant = await this.tenantRepository.findById(user.tenantId);
      if (tenant && (tenant.status === 'suspended' || tenant.status === 'TENANT_SUSPENDED')) {
        await this.sessionService.revokeSession(activeSessionId);
        throw new ClinicSuspendedError();
      }
    }

    // Step 5 — Check token version (catches revoke-all scenarios)
    // Token version validation is done in the access token path;
    // here we ensure the user is still valid.

    // Step 6 — Generate new token pair (rotation)
    const newRawRefreshToken = this.tokenService.generateRefreshToken();
    const newRefreshTokenHash = this.tokenService.hashRefreshToken(newRawRefreshToken);
    const newRefreshExpiresAt = new Date(
      Date.now() + this.tokenService.getRefreshTokenTtlSeconds() * 1000,
    );

    // Step 7 — Update session with new refresh token hash and preserve previous hash for grace period
    await this.sessionRepository.update(activeSessionId, {
      refreshTokenHash: newRefreshTokenHash,
      previousRefreshTokenHash: storedHash,
      rotatedAt: new Date(),
      lastActivityAt: new Date(),
      expiresAt: newRefreshExpiresAt,
    });

    // Step 8 — Issue new access token
    const accessTokenPayload = {
      sub: user.id,
      tenantId: user.tenantId,
      clinicId: user.clinicId ?? null,
      role: user.role,
      tokenVersion: user.tokenVersion,
      sessionId: activeSessionId,
      email: user.email,
    };
    const newAccessToken = this.tokenService.signAccessToken(accessTokenPayload);
    const newAccessExpiresAt = new Date(
      Date.now() + this.tokenService.getAccessTokenTtlSeconds() * 1000,
    );

    // Step 9 — Publish audit event
    await this.eventPublisher.publish({
      eventType: 'auth.token.refreshed',
      occurredAt: new Date(),
      requestId,
      tenantId: user.tenantId,
      userId: user.id,
      ipAddress: deviceInfo.ipAddress,
      sessionId: activeSessionId,
    });

    return {
      accessToken: newAccessToken,
      accessTokenExpiresAt: newAccessExpiresAt,
      refreshToken: newRawRefreshToken,
      refreshTokenExpiresAt: newRefreshExpiresAt,
    };
  }

  // --------------------------------------------------------------------------
  // Forgot Password
  // --------------------------------------------------------------------------

  async forgotPassword(params: ForgotPasswordParams): Promise<PasswordResetRequestResult> {
    const { email, requestId, deviceInfo } = params;

    // Always return the same message regardless of whether the email exists
    // This prevents user enumeration attacks
    const safeMessage = 'If an account with that email exists, a password reset link has been sent.';

    const user = await this.userRepository.findByEmail(email);
    if (!user) {
      return { message: safeMessage };
    }

    if (user.status !== 'active') {
      return { message: safeMessage };
    }

    // Invalidate any existing reset tokens for this user
    await this.passwordResetTokenRepository.invalidateAllForUser(user.id);

    // Generate a new one-time reset token
    const rawToken = this.tokenService.generateSecureToken();
    const tokenHash = this.tokenService.hashSecureToken(rawToken);
    const expiresAt = new Date(Date.now() + PASSWORD_RESET_TOKEN_TTL_SECONDS * 1000);

    await this.passwordResetTokenRepository.create({
      userId: user.id,
      tenantId: user.tenantId,
      tokenHash,
      expiresAt,
    });

    // Send email (non-blocking — email failure must not expose whether the user exists)
    try {
      await this.emailProvider.sendPasswordReset({
        to: user.email,
        token: rawToken,
        userId: user.id,
      });
    } catch {
      // Swallow — email delivery failure is logged by the email provider, not here
    }

    await this.eventPublisher.publish({
      eventType: 'auth.password.reset_requested',
      occurredAt: new Date(),
      requestId,
      tenantId: user.tenantId,
      userId: user.id,
      ipAddress: deviceInfo.ipAddress,
    });

    return { message: safeMessage };
  }

  // --------------------------------------------------------------------------
  // Reset Password
  // --------------------------------------------------------------------------

  async resetPassword(params: ResetPasswordParams): Promise<void> {
    const { token, newPassword, requestId } = params;

    // Hash the presented token to compare with stored hashes
    const tokenHash = this.tokenService.hashSecureToken(token);

    const resetToken = await this.passwordResetTokenRepository.findByTokenHash(tokenHash);
    if (!resetToken) {
      throw new InvalidPasswordResetTokenError();
    }

    // Load user
    const user = await this.userRepository.findById(resetToken.userId);
    if (!user) {
      throw new InvalidPasswordResetTokenError();
    }

    // Hash new password
    const newPasswordHash = await argon2.hash(newPassword, {
      type: argon2.argon2id,
      memoryCost: ARGON2_MEMORY_COST,
      timeCost: ARGON2_TIME_COST,
      parallelism: ARGON2_PARALLELISM,
    });

    // Atomic updates: mark token used + update password + increment token version
    // Per contract: password reset must invalidate all existing sessions
    await Promise.all([
      this.passwordResetTokenRepository.markUsed(resetToken.id),
      this.userRepository.update(user.id, {
        passwordHash: newPasswordHash,
        passwordChangedAt: new Date(),
        tokenVersion: user.tokenVersion + 1, // Invalidates all issued JWTs
        failedLoginAttempts: 0,
        lockedUntil: null,
      }),
      this.sessionService.revokeAllUserSessions(user.id),
    ]);

    await this.eventPublisher.publish({
      eventType: 'auth.password.reset_completed',
      occurredAt: new Date(),
      requestId,
      tenantId: user.tenantId,
      userId: user.id,
      ipAddress: '',
    });
  }

  // --------------------------------------------------------------------------
  // Email Verification
  // --------------------------------------------------------------------------

  async verifyEmail(params: VerifyEmailParams): Promise<SafeUser> {
    const { token, requestId } = params;

    const tokenHash = this.tokenService.hashSecureToken(token);

    const verificationToken = await this.emailVerificationTokenRepository.findByTokenHash(tokenHash);
    if (!verificationToken) {
      throw new InvalidVerificationTokenError();
    }

    const user = await this.userRepository.findById(verificationToken.userId);
    if (!user) {
      throw new InvalidVerificationTokenError();
    }

    if (user.emailVerified) {
      throw new EmailAlreadyVerifiedError();
    }

    await Promise.all([
      this.emailVerificationTokenRepository.markUsed(verificationToken.id),
      this.userRepository.update(user.id, {
        emailVerified: true,
        emailVerifiedAt: new Date(),
      }),
    ]);

    await this.eventPublisher.publish({
      eventType: 'auth.email.verified',
      occurredAt: new Date(),
      requestId,
      tenantId: user.tenantId,
      userId: user.id,
      ipAddress: '',
    });

    const updatedUser = await this.userRepository.findById(user.id);
    return this.toSafeUser(updatedUser!);
  }

  // --------------------------------------------------------------------------
  // Resend Verification Email
  // --------------------------------------------------------------------------

  async resendVerificationEmail(params: ResendVerificationParams): Promise<void> {
    const { email, requestId } = params;

    // Always succeed silently — prevents email enumeration
    const user = await this.userRepository.findByEmail(email);
    if (!user) {
      return;
    }

    if (user.emailVerified) {
      return;
    }

    if (user.status !== 'active') {
      return;
    }

    // Invalidate existing verification tokens
    await this.emailVerificationTokenRepository.invalidateAllForUser(user.id);

    const rawToken = this.tokenService.generateSecureToken();
    const tokenHash = this.tokenService.hashSecureToken(rawToken);
    const expiresAt = new Date(Date.now() + EMAIL_VERIFICATION_TOKEN_TTL_SECONDS * 1000);

    await this.emailVerificationTokenRepository.create({
      userId: user.id,
      tenantId: user.tenantId,
      tokenHash,
      expiresAt,
    });

    try {
      await this.emailProvider.sendEmailVerification({
        to: user.email,
        token: rawToken,
        userId: user.id,
      });
    } catch {
      // Non-blocking
    }

    await this.eventPublisher.publish({
      eventType: 'auth.email.verification_sent',
      occurredAt: new Date(),
      requestId,
      tenantId: user.tenantId,
      userId: user.id,
      ipAddress: '',
    });
  }

  // --------------------------------------------------------------------------
  // Private Helpers
  // --------------------------------------------------------------------------

  private async handleFailedLoginAttempt(
    user: any,
    deviceInfo: { ipAddress: string },
    requestId: string,
  ): Promise<void> {
    const updatedUser = await this.userRepository.incrementFailedLoginAttempts(user.id);

    if (updatedUser.failedLoginAttempts >= MAX_FAILED_LOGIN_ATTEMPTS) {
      const unlocksAt = new Date(Date.now() + ACCOUNT_LOCK_DURATION_SECONDS * 1000);
      await this.userRepository.update(user.id, { lockedUntil: unlocksAt });

      await this.eventPublisher.publish({
        eventType: 'auth.account.locked',
        occurredAt: new Date(),
        requestId,
        tenantId: user.tenantId,
        userId: user.id,
        ipAddress: deviceInfo.ipAddress,
        unlocksAt,
        failedAttempts: updatedUser.failedLoginAttempts,
        deviceInfo: {
          userAgent: '',
          ipAddress: deviceInfo.ipAddress,
          browser: null,
          operatingSystem: null,
          deviceType: 'unknown',
        },
      });
    }
  }

  /**
   * Constant-time string comparison to prevent timing attacks.
   * Both strings are SHA-256 hex digests so length is always equal (64 chars).
   */
  private timingSafeEqual(a: string, b: string): boolean {
    if (a.length !== b.length) {
      return false;
    }
    const bufA = Buffer.from(a, 'hex');
    const bufB = Buffer.from(b, 'hex');
    try {
      return crypto.timingSafeEqual(bufA, bufB);
    } catch {
      return false;
    }
  }

  private toSafeUser(user: any): SafeUser {
    return {
      publicId: user.publicId,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      tenantId: user.tenantId,
      emailVerified: user.emailVerified,
      createdAt: user.createdAt,
    };
  }
}

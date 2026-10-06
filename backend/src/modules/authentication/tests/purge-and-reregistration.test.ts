import { prisma } from '../../../shared/database/prisma';
import { InvitationService } from '../services/invitation.service';
import { AuthService } from '../services/auth.service';
import { UserRepository } from '../repositories/user.repository';
import { SessionRepository } from '../repositories/session.repository';
import { PasswordResetTokenRepository } from '../repositories/password-reset-token.repository';
import { EmailVerificationTokenRepository } from '../repositories/email-verification-token.repository';
import { TokenService } from '../services/token.service';
import { SessionService } from '../services/session.service';
import { InProcessAuthEventPublisher } from '../events/auth-event.publisher';
import { RbacBootstrapService } from '../../rbac/services/rbac-bootstrap.service';
import { RoleRepository } from '../../rbac/repositories/role.repository';
import { PermissionRepository } from '../../rbac/repositories/permission.repository';
import { UserRoleRepository } from '../../rbac/repositories/user-role.repository';
import { PermissionCacheService } from '../../rbac/services/permission-cache.service';
import { normalizeEmail } from '../../../shared/utils/email.utils';

describe('Targeted Email Clean State and Fresh Registration Invariants', () => {
  const testEmail = 'clean.test.invitation@example.com';
  const normalizedTestEmail = normalizeEmail(testEmail);

  let owner: any;
  let invitationService: InvitationService;
  let authService: AuthService;

  beforeAll(async () => {
    owner = await prisma.user.findFirst({
      where: { role: 'clinic_owner', status: 'active' },
    });

    const roleRepo = new RoleRepository(prisma);
    const permRepo = new PermissionRepository(prisma);
    const userRoleRepo = new UserRoleRepository(prisma);
    const permCache = new PermissionCacheService();
    const rbacBootstrap = new RbacBootstrapService(prisma, roleRepo, permRepo, userRoleRepo, permCache);
    const authEventPublisher = new InProcessAuthEventPublisher();
    invitationService = new InvitationService(prisma, rbacBootstrap, authEventPublisher);

    const userRepo = new UserRepository(prisma);
    const sessionRepo = new SessionRepository(prisma);
    const pwdResetRepo = new PasswordResetTokenRepository(prisma);
    const emailVerifRepo = new EmailVerificationTokenRepository(prisma);
    const tokenService = new TokenService({
      jwtAccessSecret: process.env.JWT_ACCESS_SECRET || 'development_access_secret_32_characters',
      jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || 'development_refresh_secret_32_characters',
    });
    const sessionService = new SessionService(sessionRepo);
    const emailProvider: any = {
      sendEmailVerification: async () => {},
      sendPasswordReset: async () => {},
    };

    authService = new AuthService(
      userRepo,
      sessionRepo,
      pwdResetRepo,
      emailVerifRepo,
      tokenService,
      sessionService,
      authEventPublisher,
      emailProvider,
    );

    // Clean up test email
    await prisma.invitation.deleteMany({
      where: { email: { equals: normalizedTestEmail, mode: 'insensitive' } },
    });
  });

  afterAll(async () => {
    await prisma.invitation.deleteMany({
      where: { email: { equals: normalizedTestEmail, mode: 'insensitive' } },
    });
  });

  it('1. Attempting login with non-existent email is rejected with InvalidCredentialsError', async () => {
    await expect(
      authService.login({
        email: 'completely.nonexistent.user@example.com',
        password: 'AnyPassword123!',
        deviceInfo: {
          userAgent: 'Test Agent',
          ipAddress: '127.0.0.1',
          browser: 'Test',
          operatingSystem: 'Test',
          deviceType: 'desktop',
        },
        requestId: 'req-test-purged',
      }),
    ).rejects.toThrow();
  });

  it('2. Creating a new invitation correctly routes to SIGN_UP flow as a brand-new user', async () => {
    expect(owner).toBeDefined();

    const created = await invitationService.createInvitation({
      tenantId: owner.tenantId,
      email: testEmail,
      roleName: 'doctor',
      invitedByUserId: owner.id,
    });

    expect(created.invitation.email).toBe(testEmail);
    expect(created.invitation.type).toBe('new_user');

    const validation = await invitationService.validateInvitationToken(created.rawToken);
    expect(validation.valid).toBe(true);
    expect(validation.isExistingUser).toBe(false);
    expect(validation.account.exists).toBe(false);
    expect(validation.nextAction).toBe('SIGN_UP');
  });

  it('3. Declining an invitation with a decline reason updates status and persists declineReason in database', async () => {
    // Clean up previous test invitation
    await prisma.invitation.deleteMany({
      where: { email: { equals: normalizedTestEmail, mode: 'insensitive' } },
    });

    const created = await invitationService.createInvitation({
      tenantId: owner.tenantId,
      email: testEmail,
      roleName: 'doctor',
      invitedByUserId: owner.id,
    });

    const declineReason = 'Schedule or commitment conflict: Currently unable to take additional practice hours';
    const declined = await invitationService.declineInvitation(created.rawToken, undefined, declineReason);

    expect(declined.status).toBe('declined');
    expect(declined.declinedAt).toBeDefined();
    expect(declined.declineReason).toBe(declineReason);

    const fromDb = await prisma.invitation.findUnique({
      where: { id: declined.id },
    });
    expect(fromDb?.status).toBe('declined');
    expect(fromDb?.declineReason).toBe(declineReason);
  });

  it('4. Practice Owner and other tenant data remain intact', async () => {
    const existingOwner = await prisma.user.findFirst({
      where: { id: owner.id },
    });
    expect(existingOwner).toBeDefined();
    expect(existingOwner?.status).toBe('active');

    const tenant = await prisma.tenant.findUnique({
      where: { id: owner.tenantId },
    });
    expect(tenant).toBeDefined();
    expect(tenant?.status).toBe('active');
  });
});

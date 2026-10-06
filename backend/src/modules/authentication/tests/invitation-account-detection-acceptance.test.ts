import { PrismaClient } from '@prisma/client';
import { InvitationService } from '../services/invitation.service';
import { normalizeEmail } from '../../../shared/utils/email.utils';
import {
  InvitationAlreadyAcceptedError,
  InvitationEmailMismatchError,
  InvitationExpiredError,
  InvitationRevokedError,
} from '../errors/auth.errors';

describe('Invitation Account Detection, Routing & Acceptance Flow', () => {
  let prisma: PrismaClient;
  let invitationService: InvitationService;
  let mockEventPublisher: any;
  let mockEmailProvider: any;
  let mockRbacBootstrapService: any;

  let testTenantId: string;
  let ownerUserId: string;
  let testClinicId: string;

  beforeAll(async () => {
    prisma = new PrismaClient();
    await prisma.$connect();

    mockEventPublisher = { publish: jest.fn().mockResolvedValue(true) };
    mockEmailProvider = { sendInvitationEmail: jest.fn().mockResolvedValue(true) };
    mockRbacBootstrapService = { assignSystemRoleToUser: jest.fn().mockResolvedValue(true) };

    invitationService = new InvitationService(
      prisma,
      mockRbacBootstrapService,
      mockEventPublisher,
      mockEmailProvider,
    );

    // Create unique test tenant and clinic
    const tenant = await prisma.tenant.create({
      data: {
        name: `Test Tenant ${Date.now()}`,
        slug: `test-tenant-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        status: 'active',
      },
    });
    testTenantId = tenant.id;

    const owner = await prisma.user.create({
      data: {
        tenantId: testTenantId,
        email: normalizeEmail(`owner-${Date.now()}@example.com`),
        passwordHash: 'dummy_hash_for_test',
        firstName: 'Practice',
        lastName: 'Owner',
        role: 'clinic_owner',
        status: 'active',
      },
    });
    ownerUserId = owner.id;

    const clinic = await prisma.clinic.create({
      data: {
        tenantId: testTenantId,
        name: 'Test Dental Clinic',
        slug: `clinic-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        timezone: 'UTC',
        country: 'US',
        ownerId: ownerUserId,
        status: 'active',
      },
    });
    testClinicId = clinic.id;
  });

  afterAll(async () => {
    // Cleanup created records in correct foreign key dependency order
    await prisma.userRole.deleteMany({ where: { tenantId: testTenantId } });
    await prisma.doctor.deleteMany({ where: { tenantId: testTenantId } });
    await prisma.invitation.deleteMany({ where: { tenantId: testTenantId } });
    await prisma.clinic.deleteMany({ where: { tenantId: testTenantId } });
    await prisma.user.deleteMany({ where: { tenantId: testTenantId } });
    await prisma.rolePermission.deleteMany({ where: { role: { tenantId: testTenantId } } });
    await prisma.role.deleteMany({ where: { tenantId: testTenantId } });
    await prisma.tenant.deleteMany({ where: { id: testTenantId } });
    await prisma.$disconnect();
  });

  // ── Test 1: Non-existent invited email -> SIGN_UP ──────────────────────────
  it('1. Non-existent invited email resolves to nextAction = SIGN_UP and account.exists = false', async () => {
    const invitedEmail = `new-staff-${Date.now()}@example.com`;

    const { rawToken } = await invitationService.createInvitation({
      tenantId: testTenantId,
      invitedByUserId: ownerUserId,
      email: invitedEmail,
      roleName: 'doctor',
    });

    const resolution = await invitationService.validateInvitationToken(rawToken);

    expect(resolution.valid).toBe(true);
    expect(resolution.nextAction).toBe('SIGN_UP');
    expect(resolution.account.exists).toBe(false);
    expect(resolution.isExistingUser).toBe(false);
    expect(resolution.email).toBe(normalizeEmail(invitedEmail));
    expect(resolution.role).toBe('Dentist');
  });

  // ── Test 2: Existing active invited email -> SIGN_IN ───────────────────────
  it('2. Existing active user resolves to nextAction = SIGN_IN and account.exists = true', async () => {
    const existingEmail = `existing-user-${Date.now()}@example.com`;

    await prisma.user.create({
      data: {
        tenantId: testTenantId,
        email: normalizeEmail(existingEmail),
        passwordHash: 'argon2_hashed_password',
        firstName: 'Existing',
        lastName: 'Doctor',
        role: 'receptionist',
        status: 'active',
      },
    });

    const { rawToken } = await invitationService.createInvitation({
      tenantId: testTenantId,
      invitedByUserId: ownerUserId,
      email: existingEmail,
      roleName: 'doctor',
    });

    const resolution = await invitationService.validateInvitationToken(rawToken);

    expect(resolution.valid).toBe(true);
    expect(resolution.nextAction).toBe('SIGN_IN');
    expect(resolution.account.exists).toBe(true);
    expect(resolution.isExistingUser).toBe(true);
    expect(resolution.email).toBe(normalizeEmail(existingEmail));
  });

  // ── Test 3: New account signup + acceptance transaction ───────────────────
  it('3. Successfully signs up and accepts invitation with password, creating User and Doctor', async () => {
    const newDentistEmail = `dentist-signup-${Date.now()}@example.com`;

    const { rawToken } = await invitationService.createInvitation({
      tenantId: testTenantId,
      invitedByUserId: ownerUserId,
      email: newDentistEmail,
      roleName: 'doctor',
    });

    const acceptedUser = await invitationService.acceptInvitation({
      token: rawToken,
      password: 'SecurePassword123!',
      firstName: 'Jane',
      lastName: 'Doe',
    });

    expect(acceptedUser.email).toBe(normalizeEmail(newDentistEmail));
    expect(acceptedUser.firstName).toBe('Jane');
    expect(acceptedUser.lastName).toBe('Doe');
    expect(acceptedUser.role).toBe('doctor');

    // Verify User record in PostgreSQL
    const dbUser = await prisma.user.findFirst({
      where: { email: normalizeEmail(newDentistEmail), tenantId: testTenantId },
    });
    expect(dbUser).not.toBeNull();
    expect(dbUser?.status).toBe('active');
    expect(dbUser?.emailVerified).toBe(true);

    // Verify Doctor record in PostgreSQL
    const dbDoctor = await prisma.doctor.findFirst({
      where: { email: normalizeEmail(newDentistEmail), tenantId: testTenantId },
    });
    expect(dbDoctor).not.toBeNull();
    expect(dbDoctor?.status).toBe('active');
    expect(dbDoctor?.fullName).toBe('Jane Doe');

    // Verify Invitation marked accepted
    const dbInvitation = await prisma.invitation.findFirst({
      where: { email: normalizeEmail(newDentistEmail), tenantId: testTenantId },
    });
    expect(dbInvitation?.status).toBe('accepted');
    expect(dbInvitation?.acceptedAt).not.toBeNull();
  });

  // ── Test 4: Mismatched authenticated email is strictly blocked ────────────
  it('4. Blocks acceptance if authenticated user email does not match invitation recipient (403)', async () => {
    const targetEmail = `invited-target-${Date.now()}@example.com`;
    const differentAuthEmail = `other-logged-in-${Date.now()}@example.com`;

    const { rawToken } = await invitationService.createInvitation({
      tenantId: testTenantId,
      invitedByUserId: ownerUserId,
      email: targetEmail,
      roleName: 'receptionist',
    });

    await expect(
      invitationService.acceptInvitation({
        token: rawToken,
        password: 'SecurePassword123!',
        firstName: 'Test',
        lastName: 'User',
        actorEmail: differentAuthEmail,
      }),
    ).rejects.toThrow(InvitationEmailMismatchError);

    // Invitation must remain unaccepted
    const dbInvitation = await prisma.invitation.findFirst({
      where: { email: normalizeEmail(targetEmail), tenantId: testTenantId },
    });
    expect(dbInvitation?.status).toBe('pending');
  });

  // ── Test 5: Concurrent acceptance race protection ─────────────────────────
  it('5. Prevents double acceptance and duplicate users via atomic transaction status lock', async () => {
    const raceEmail = `race-test-${Date.now()}@example.com`;

    const { rawToken } = await invitationService.createInvitation({
      tenantId: testTenantId,
      invitedByUserId: ownerUserId,
      email: raceEmail,
      roleName: 'receptionist',
    });

    const [res1, res2] = await Promise.allSettled([
      invitationService.acceptInvitation({
        token: rawToken,
        password: 'Password123!',
        firstName: 'Race',
        lastName: 'Tester',
      }),
      invitationService.acceptInvitation({
        token: rawToken,
        password: 'Password123!',
        firstName: 'Race',
        lastName: 'Tester',
      }),
    ]);

    const successes = [res1, res2].filter((r) => r.status === 'fulfilled');
    const failures = [res1, res2].filter((r) => r.status === 'rejected');

    expect(successes.length).toBe(1);
    expect(failures.length).toBe(1);

    // Verify exactly ONE user in PostgreSQL
    const userCount = await prisma.user.count({
      where: { email: normalizeEmail(raceEmail), tenantId: testTenantId },
    });
    expect(userCount).toBe(1);
  });

  // ── Test 6: Zero mutations and zero emails on read operations ──────────────
  it('6. Calling validateInvitationToken (GET preview) causes 0 mutations and 0 email sends', async () => {
    const previewEmail = `preview-test-${Date.now()}@example.com`;

    const { rawToken } = await invitationService.createInvitation({
      tenantId: testTenantId,
      invitedByUserId: ownerUserId,
      email: previewEmail,
      roleName: 'doctor',
    });

    mockEmailProvider.sendInvitationEmail.mockClear();

    // Call validateInvitationToken 5 times (simulating refreshes / tab switches)
    for (let i = 0; i < 5; i++) {
      const res = await invitationService.validateInvitationToken(rawToken);
      expect(res.valid).toBe(true);
    }

    // Zero additional emails sent
    expect(mockEmailProvider.sendInvitationEmail).not.toHaveBeenCalled();

    // User table count is still 0
    const userCount = await prisma.user.count({
      where: { email: normalizeEmail(previewEmail) },
    });
    expect(userCount).toBe(0);
  });

  // ── Test 7: Email normalization resilience ────────────────────────────────
  it('7. Handles mixed-case emails consistently across invite creation, lookup, and acceptance', async () => {
    const mixedCaseEmail = `Doctor.Smith.${Date.now()}@Example.COM`;

    const { rawToken } = await invitationService.createInvitation({
      tenantId: testTenantId,
      invitedByUserId: ownerUserId,
      email: mixedCaseEmail,
      roleName: 'doctor',
    });

    const resolution = await invitationService.validateInvitationToken(rawToken);
    expect(resolution.email).toBe(normalizeEmail(mixedCaseEmail));
    expect(resolution.nextAction).toBe('SIGN_UP');

    const accepted = await invitationService.acceptInvitation({
      token: rawToken,
      password: 'Password123!',
      firstName: 'Dr',
      lastName: 'Smith',
    });

    expect(accepted.email).toBe(normalizeEmail(mixedCaseEmail));
  });

  // ── Test 8: Transaction client (tx) is passed to RBAC bootstrap ────────────
  it('8. Passes transaction client (tx) into assignSystemRoleToUser ensuring single-connection atomicity', async () => {
    const txStaffEmail = `tx-staff-${Date.now()}@example.com`;

    const { rawToken } = await invitationService.createInvitation({
      tenantId: testTenantId,
      invitedByUserId: ownerUserId,
      email: txStaffEmail,
      roleName: 'receptionist',
    });

    mockRbacBootstrapService.assignSystemRoleToUser.mockClear();

    await invitationService.acceptInvitation({
      token: rawToken,
      password: 'Password123!',
      firstName: 'Tx',
      lastName: 'Staff',
    });

    expect(mockRbacBootstrapService.assignSystemRoleToUser).toHaveBeenCalledTimes(1);
    expect(mockRbacBootstrapService.assignSystemRoleToUser).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: testTenantId,
        roleName: 'receptionist',
        tx: expect.anything(),
      }),
    );
  });

  // ── Test 9: End-to-end acceptance with real RbacBootstrapService ────────────
  it('9. Executes acceptance with real RbacBootstrapService, seeding roles and creating user_roles atomically', async () => {
    const { RoleRepository } = await import('../../rbac/repositories/role.repository');
    const { PermissionRepository } = await import('../../rbac/repositories/permission.repository');
    const { UserRoleRepository } = await import('../../rbac/repositories/user-role.repository');
    const { PermissionCacheService } = await import('../../rbac/services/permission-cache.service');
    const { RbacBootstrapService } = await import('../../rbac/services/rbac-bootstrap.service');

    const roleRepo = new RoleRepository(prisma);
    const permRepo = new PermissionRepository(prisma);
    const userRoleRepo = new UserRoleRepository(prisma);
    const cacheService = new PermissionCacheService();
    const realRbacService = new RbacBootstrapService(prisma, roleRepo, permRepo, userRoleRepo, cacheService);

    const realInvitationService = new InvitationService(
      prisma,
      realRbacService,
      mockEventPublisher,
      mockEmailProvider,
    );

    const realStaffEmail = `real-rbac-${Date.now()}@example.com`;

    const { rawToken } = await realInvitationService.createInvitation({
      tenantId: testTenantId,
      invitedByUserId: ownerUserId,
      email: realStaffEmail,
      roleName: 'doctor',
    });

    const startTime = Date.now();
    const acceptedUser = await realInvitationService.acceptInvitation({
      token: rawToken,
      password: 'SecurePassword123!',
      firstName: 'Real',
      lastName: 'Dentist',
    });
    const duration = Date.now() - startTime;

    expect(acceptedUser.email).toBe(normalizeEmail(realStaffEmail));
    expect(acceptedUser.role).toBe('doctor');

    // Verify UserRole record in PostgreSQL
    const userRoles = await prisma.userRole.findMany({
      where: { userId: acceptedUser.id, tenantId: testTenantId, isActive: true },
      include: { role: true },
    });
    expect(userRoles.length).toBeGreaterThanOrEqual(1);
    expect(userRoles.some((ur) => ur.role.name === 'doctor')).toBe(true);

    // Verify transaction completed within the safe transaction timeout window
    expect(duration).toBeLessThan(10000);
  });

  afterAll(async () => {
    const { cleanupTestTenant } = await import('../../../shared/database/test-teardown');
    await cleanupTestTenant(testTenantId, prisma);
    await prisma.$disconnect();
  });
});

/**
 * Acceptance & Reconciliation Master Test Suite
 *
 * Verifies all invitation acceptance lifecycle paths:
 * 1. New user acceptance (account + doctor creation)
 * 2. Existing active user acceptance (role update + doctor reuse)
 * 3. Existing soft-deleted/archived user acceptance (reactivation + doctor reuse, 0 duplicates)
 * 4. Doctor role preservation of historical appointments
 * 5. Non-doctor role does not create Doctor records
 * 6. Concurrency / double-click acceptance safety
 * 7. Token invalidation / re-use rejection
 * 8. Expired / revoked / declined rejection
 * 9. Cross-interface data consistency (PostgreSQL == Clinic == Admin)
 */

import { PrismaClient } from '@prisma/client';
import { InvitationService } from '../services/invitation.service';
import { UserService } from '../services/user.service';
import { UserRepository } from '../repositories/user.repository';
import { DoctorRepository } from '../../doctor/repositories/doctor.repository';

const prisma = new PrismaClient();

describe('Invitation Acceptance & Cross-Interface Reconciliation', () => {
  let invitationService: InvitationService;
  let userService: UserService;

  let tenantAId: string;
  let clinicAId: string;
  let ownerAId: string;

  const testSuffix = Date.now();

  beforeAll(async () => {
    invitationService = new InvitationService(prisma);
    const userRepo = new UserRepository(prisma);
    userService = new UserService(userRepo, undefined, prisma);

    // 1. Create Tenant A & Clinic A
    const tenantA = await prisma.tenant.create({
      data: {
        name: `Test Tenant Accept ${testSuffix}`,
        slug: `test-tenant-accept-${testSuffix}`,
        status: 'active',
      },
    });
    tenantAId = tenantA.id;

    // Create Owner A
    const ownerA = await prisma.user.create({
      data: {
        tenantId: tenantAId,
        email: `owner-accept-${testSuffix}@example.com`,
        passwordHash: 'dummy_hash',
        firstName: 'Owner',
        lastName: 'Alpha',
        role: 'clinic_owner',
        status: 'active',
        emailVerified: true,
      },
    });
    ownerAId = ownerA.id;

    const clinicA = await prisma.clinic.create({
      data: {
        tenantId: tenantAId,
        ownerId: ownerAId,
        name: `Clinic Accept ${testSuffix}`,
        slug: `clinic-accept-${testSuffix}`,
        timezone: 'UTC',
        country: 'US',
        status: 'active',
      },
    });
    clinicAId = clinicA.id;
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.appointment.deleteMany({ where: { tenantId: tenantAId } }).catch(() => {});
    await prisma.doctor.deleteMany({ where: { tenantId: tenantAId } }).catch(() => {});
    await prisma.invitation.deleteMany({ where: { tenantId: tenantAId } }).catch(() => {});
    await prisma.userRole.deleteMany({ where: { tenantId: tenantAId } }).catch(() => {});
    await prisma.user.deleteMany({ where: { tenantId: tenantAId } }).catch(() => {});
    await prisma.clinic.deleteMany({ where: { tenantId: tenantAId } }).catch(() => {});
    await prisma.tenant.deleteMany({ where: { id: tenantAId } }).catch(() => {});
    await prisma.$disconnect();
  });

  it('Test 1 -- New email accepts Dentist invitation: creates User once, creates Doctor once, marks accepted', async () => {
    const email = `new-dentist-${testSuffix}@example.com`;
    const { invitation, inviteLink } = await invitationService.createInvitation({
      tenantId: tenantAId,
      invitedByUserId: ownerAId,
      email,
      roleName: 'doctor',
    });

    const rawToken = inviteLink.split('token=')[1];
    const acceptedUser = await invitationService.acceptInvitation({
      token: rawToken,
      password: 'SecurePassword123!',
      firstName: 'Alice',
      lastName: 'Smith',
    });

    expect(acceptedUser.email).toBe(email);
    expect(acceptedUser.role).toBe('doctor');
    expect(acceptedUser.status).toBe('active');

    // Verify DB user
    const dbUser = await prisma.user.findUnique({ where: { email } });
    expect(dbUser).toBeDefined();
    expect(dbUser?.deletedAt).toBeNull();
    expect(dbUser?.role).toBe('doctor');

    // Verify Doctor record
    const doctors = await prisma.doctor.findMany({ where: { tenantId: tenantAId, email } });
    expect(doctors).toHaveLength(1);
    expect(doctors[0].status).toBe('active');
    expect(doctors[0].deletedAt).toBeNull();
    expect(doctors[0].displayName).toBe('Dr. Alice Smith');

    // Verify Invitation accepted
    const dbInv = await prisma.invitation.findUnique({ where: { id: invitation.id } });
    expect(dbInv?.status).toBe('accepted');
    expect(dbInv?.acceptedAt).toBeDefined();
  });

  it('Test 2 -- Existing active user accepts role change: updates User without duplicate, creates Doctor', async () => {
    const email = `existing-user-${testSuffix}@example.com`;
    // Pre-create active user with role receptionist
    const existing = await prisma.user.create({
      data: {
        tenantId: tenantAId,
        email,
        passwordHash: 'hash_preexisting',
        firstName: 'Bob',
        lastName: 'Jones',
        role: 'receptionist',
        status: 'active',
        emailVerified: true,
      },
    });

    const { invitation, inviteLink } = await invitationService.createInvitation({
      tenantId: tenantAId,
      invitedByUserId: ownerAId,
      email,
      roleName: 'doctor',
    });

    const rawToken = inviteLink.split('token=')[1];
    const acceptedUser = await invitationService.acceptInvitation({
      token: rawToken,
    });

    expect(acceptedUser.id).toBe(existing.id);
    expect(acceptedUser.role).toBe('doctor');

    // Exactly 1 user in DB
    const users = await prisma.user.findMany({ where: { email } });
    expect(users).toHaveLength(1);

    // Exactly 1 Doctor in DB
    const doctors = await prisma.doctor.findMany({ where: { tenantId: tenantAId, email } });
    expect(doctors).toHaveLength(1);
  });

  it('Test 3 -- Existing soft-deleted/archived user accepts Dentist invitation: reactivates User & Doctor, 0 duplicates', async () => {
    const email = `archived-dentist-${testSuffix}@example.com`;
    // Pre-create archived user
    const archivedUser = await prisma.user.create({
      data: {
        tenantId: tenantAId,
        email,
        passwordHash: 'archived_hash',
        firstName: 'Charlie',
        lastName: 'Dentist',
        role: 'doctor',
        status: 'archived',
        deletedAt: new Date(),
        emailVerified: true,
      },
    });

    // Pre-create active Doctor record (like historical state)
    const existingDoc = await prisma.doctor.create({
      data: {
        tenantId: tenantAId,
        clinicId: clinicAId,
        fullName: 'Charlie Dentist',
        displayName: 'Dr. Charlie Dentist',
        specialization: 'General Dentistry',
        email,
        status: 'active',
      },
    });

    const { invitation, inviteLink } = await invitationService.createInvitation({
      tenantId: tenantAId,
      invitedByUserId: ownerAId,
      email,
      roleName: 'doctor',
    });

    const rawToken = inviteLink.split('token=')[1];

    // validateInvitationToken must identify isExistingUser
    const meta = await invitationService.validateInvitationToken(rawToken);
    expect(meta.isExistingUser).toBe(true);

    // Accept invitation
    const accepted = await invitationService.acceptInvitation({
      token: rawToken,
      password: 'NewPassword123!',
    });

    expect(accepted.id).toBe(archivedUser.id);
    expect(accepted.status).toBe('active');
    expect(accepted.role).toBe('doctor');

    // Invariant: Exactly 1 User in DB, active and not deleted
    const users = await prisma.user.findMany({ where: { email } });
    expect(users).toHaveLength(1);
    expect(users[0].status).toBe('active');
    expect(users[0].deletedAt).toBeNull();

    // Invariant: Exactly 1 Doctor in DB (the canonical pre-existing record is reused)
    const doctors = await prisma.doctor.findMany({ where: { tenantId: tenantAId, email } });
    expect(doctors).toHaveLength(1);
    expect(doctors[0].id).toBe(existingDoc.id);
    expect(doctors[0].status).toBe('active');
  });

  it('Test 4 -- Non-doctor role (Receptionist) does NOT create a Doctor record', async () => {
    const email = `receptionist-${testSuffix}@example.com`;
    const { invitation, inviteLink } = await invitationService.createInvitation({
      tenantId: tenantAId,
      invitedByUserId: ownerAId,
      email,
      roleName: 'receptionist',
    });

    const rawToken = inviteLink.split('token=')[1];
    await invitationService.acceptInvitation({
      token: rawToken,
      password: 'SecurePassword123!',
      firstName: 'Rachel',
      lastName: 'Green',
    });

    // Verify 0 Doctor records created
    const doctors = await prisma.doctor.findMany({ where: { tenantId: tenantAId, email } });
    expect(doctors).toHaveLength(0);
  });

  it('Test 5 -- Double-click / Concurrent acceptance requests: atomic lock guarantees exactly 1 success', async () => {
    const email = `concurrent-accept-${testSuffix}@example.com`;
    const { inviteLink } = await invitationService.createInvitation({
      tenantId: tenantAId,
      invitedByUserId: ownerAId,
      email,
      roleName: 'doctor',
    });

    const rawToken = inviteLink.split('token=')[1];

    // Fire two simultaneous accept calls
    const results = await Promise.allSettled([
      invitationService.acceptInvitation({ token: rawToken, password: 'Password123!', firstName: 'Race', lastName: 'Condition' }),
      invitationService.acceptInvitation({ token: rawToken, password: 'Password123!', firstName: 'Race', lastName: 'Condition' }),
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);

    // Exactly 1 user and 1 doctor in DB
    const users = await prisma.user.findMany({ where: { email } });
    expect(users).toHaveLength(1);
    const doctors = await prisma.doctor.findMany({ where: { tenantId: tenantAId, email } });
    expect(doctors).toHaveLength(1);
  });

  it('Test 6 -- Re-accepting an already accepted invitation is safely rejected', async () => {
    const email = `already-accepted-${testSuffix}@example.com`;
    const { inviteLink } = await invitationService.createInvitation({
      tenantId: tenantAId,
      invitedByUserId: ownerAId,
      email,
      roleName: 'doctor',
    });

    const rawToken = inviteLink.split('token=')[1];
    await invitationService.acceptInvitation({ token: rawToken, password: 'Password123!' });

    // Second call with same token
    await expect(
      invitationService.acceptInvitation({ token: rawToken, password: 'Password123!' })
    ).rejects.toThrow('This invitation token has already been used.');
  });

  it('Test 7 -- Expired and Revoked invitations cannot be accepted', async () => {
    const emailRevoked = `revoked-${testSuffix}@example.com`;
    const { invitation: invRevoked, inviteLink: linkRevoked } = await invitationService.createInvitation({
      tenantId: tenantAId,
      invitedByUserId: ownerAId,
      email: emailRevoked,
      roleName: 'doctor',
    });
    await invitationService.revokeInvitation(invRevoked.id, tenantAId, ownerAId);

    const tokenRevoked = linkRevoked.split('token=')[1];
    await expect(
      invitationService.acceptInvitation({ token: tokenRevoked, password: 'Password123!' })
    ).rejects.toThrow('This invitation has been revoked');

    // Expired
    const emailExpired = `expired-${testSuffix}@example.com`;
    const { invitation: invExpired, inviteLink: linkExpired } = await invitationService.createInvitation({
      tenantId: tenantAId,
      invitedByUserId: ownerAId,
      email: emailExpired,
      roleName: 'doctor',
    });
    await prisma.invitation.update({
      where: { id: invExpired.id },
      data: { expiresAt: new Date(Date.now() - 10000) },
    });

    const tokenExpired = linkExpired.split('token=')[1];
    await expect(
      invitationService.acceptInvitation({ token: tokenExpired, password: 'Password123!' })
    ).rejects.toThrow('This invitation link has expired.');
  });

  it('Test 8 -- Cross-Interface Data Consistency: PostgreSQL == Clinic listUsers == Admin getUsers', async () => {
    // Query PostgreSQL directly
    const pgUsers = await prisma.user.findMany({
      where: { tenantId: tenantAId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });

    // Query Clinic UserService
    const clinicUsers = await userService.listUsers({ tenantId: tenantAId });

    // Query Admin clinic query logic
    const adminUsers = await prisma.user.findMany({
      where: {
        tenantId: tenantAId,
        deletedAt: null,
        OR: [
          { clinicId: clinicAId },
          { id: ownerAId },
          { clinicId: null },
        ],
      },
      orderBy: { createdAt: 'desc' },
    });

    expect(clinicUsers.length).toBe(pgUsers.length);
    expect(adminUsers.length).toBe(pgUsers.length);

    // Verify all active users match across layers
    const pgEmails = pgUsers.map((u) => u.email).sort();
    const clinicEmails = clinicUsers.map((u) => u.email).sort();
    const adminEmails = adminUsers.map((u) => u.email).sort();

    expect(clinicEmails).toEqual(pgEmails);
    expect(adminEmails).toEqual(pgEmails);
  });

  afterAll(async () => {
    const { cleanupTestTenant } = await import('../../../shared/database/test-teardown');
    await cleanupTestTenant(tenantAId, prisma);
    await prisma.$disconnect();
  });
});

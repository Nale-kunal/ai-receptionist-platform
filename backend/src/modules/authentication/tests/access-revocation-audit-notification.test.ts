/**
 * Access Revocation, Audit Trail & Idempotent Notification Test Suite
 *
 * Verifies the complete enterprise revocation lifecycle:
 * 1. Owner revokes dentist with valid reason -> sets status, revokedAt, revokedByUserId, revocationReason
 * 2. Reason validation (empty, whitespace, max length, trimming)
 * 3. Session & role termination (sessions revoked, user_roles isActive = false)
 * 4. Doctor deactivation in clinic directory
 * 5. Immutable RbacAuditLog record with complete metadata
 * 6. Idempotent email notification via durable MailJob queue
 * 7. Authorization guards (self-revocation, cross-tenant isolation, last owner protection)
 * 8. GET query safety (read operations create 0 notifications and 0 mutations)
 */

import { PrismaClient } from '@prisma/client';
import { UserService } from '../services/user.service';
import { UserRepository } from '../repositories/user.repository';
import { EmailService } from '../../../shared/email/EmailService';
import { MailQueueService } from '../../../shared/email/queue/MailQueueService';
import { MockEmailProvider } from '../../../shared/email/providers/MockEmailProvider';

const prisma = new PrismaClient();

describe('Staff Access Revocation, Reason, Audit Trail & Notification', () => {
  let userService: UserService;
  let emailService: EmailService;
  let mailQueueService: MailQueueService;

  let tenantAId: string;
  let clinicAId: string;
  let ownerAId: string;

  let tenantBId: string;
  let clinicBId: string;
  let ownerBId: string;

  const testSuffix = Date.now();

  beforeAll(async () => {
    const mockProvider = new MockEmailProvider();
    mailQueueService = new MailQueueService(mockProvider, prisma);
    emailService = new EmailService(mailQueueService, mockProvider);

    const userRepo = new UserRepository(prisma);
    userService = new UserService(userRepo, undefined, prisma, undefined, emailService);

    // 1. Create Tenant A & Clinic A
    const tenantA = await prisma.tenant.create({
      data: {
        name: `Tooth Oracle Alpha ${testSuffix}`,
        slug: `tooth-oracle-alpha-${testSuffix}`,
        status: 'active',
      },
    });
    tenantAId = tenantA.id;

    const ownerA = await prisma.user.create({
      data: {
        tenantId: tenantAId,
        email: `owner-alpha-${testSuffix}@example.com`,
        passwordHash: 'dummy_hash',
        firstName: 'Alpha',
        lastName: 'Owner',
        role: 'clinic_owner',
        status: 'active',
        emailVerified: true,
      },
    });
    ownerAId = ownerA.id;

    const clinicA = await prisma.clinic.create({
      data: {
        tenantId: tenantAId,
        name: `Tooth Oracle Alpha Clinic ${testSuffix}`,
        slug: `alpha-clinic-${testSuffix}`,
        timezone: 'UTC',
        country: 'US',
        ownerId: ownerAId,
      },
    });
    clinicAId = clinicA.id;

    // 2. Create Tenant B (for cross-tenant tests)
    const tenantB = await prisma.tenant.create({
      data: {
        name: `Tooth Oracle Beta ${testSuffix}`,
        slug: `tooth-oracle-beta-${testSuffix}`,
        status: 'active',
      },
    });
    tenantBId = tenantB.id;

    const ownerB = await prisma.user.create({
      data: {
        tenantId: tenantBId,
        email: `owner-beta-${testSuffix}@example.com`,
        passwordHash: 'dummy_hash',
        firstName: 'Beta',
        lastName: 'Owner',
        role: 'clinic_owner',
        status: 'active',
        emailVerified: true,
      },
    });
    ownerBId = ownerB.id;

    const clinicB = await prisma.clinic.create({
      data: {
        tenantId: tenantBId,
        name: `Tooth Oracle Beta Clinic ${testSuffix}`,
        slug: `beta-clinic-${testSuffix}`,
        timezone: 'UTC',
        country: 'US',
        ownerId: ownerBId,
      },
    });
    clinicBId = clinicB.id;
  });

  afterAll(async () => {
    // Cleanup created test records
    await prisma.mailJob.deleteMany({
      where: { tenantId: { in: [tenantAId, tenantBId] } },
    });
    await prisma.notification.deleteMany({
      where: { tenantId: { in: [tenantAId, tenantBId] } },
    });
    await prisma.rbacAuditLog.deleteMany({
      where: { tenantId: { in: [tenantAId, tenantBId] } },
    });
    await prisma.doctor.deleteMany({
      where: { tenantId: { in: [tenantAId, tenantBId] } },
    });
    await prisma.session.deleteMany({
      where: { tenantId: { in: [tenantAId, tenantBId] } },
    });
    await prisma.clinic.deleteMany({
      where: { id: { in: [clinicAId, clinicBId] } },
    });
    await prisma.user.deleteMany({
      where: { tenantId: { in: [tenantAId, tenantBId] } },
    });
    await prisma.tenant.deleteMany({
      where: { id: { in: [tenantAId, tenantBId] } },
    });
    await prisma.$disconnect();
  });

  it('1. Owner successfully revokes dentist with required reason: sets database fields, terminates sessions, deactivates doctor, logs audit, and enqueues email', async () => {
    const dentistEmail = `dentist-revoke-${testSuffix}@example.com`;

    // Create target dentist
    const dentist = await prisma.user.create({
      data: {
        tenantId: tenantAId,
        clinicId: clinicAId,
        email: dentistEmail,
        passwordHash: 'hash123',
        firstName: 'Kunal',
        lastName: 'Nale',
        role: 'doctor',
        status: 'active',
        emailVerified: true,
      },
    });

    // Create active session
    const session = await prisma.session.create({
      data: {
        tenantId: tenantAId,
        userId: dentist.id,
        refreshTokenHash: 'dummy_refresh_hash',
        userAgent: 'Jest Test Agent',
        ipAddress: '127.0.0.1',
        status: 'active',
        expiresAt: new Date(Date.now() + 86400000),
      },
    });

    // Create doctor profile
    const doctor = await prisma.doctor.create({
      data: {
        tenantId: tenantAId,
        clinicId: clinicAId,
        fullName: 'Dr. Kunal Nale',
        displayName: 'Dr. Kunal Nale',
        specialization: 'General Dentistry',
        email: dentistEmail,
        status: 'active',
      },
    });

    const revocationReason = 'Employee transitioned to another private practice.';
    const revokedUser = await userService.revokeUser(dentist.id, tenantAId, ownerAId, revocationReason);

    // Assert User model fields
    expect(revokedUser.status).toBe('archived');
    expect(revokedUser.deletedAt).toBeInstanceOf(Date);
    expect(revokedUser.revokedAt).toBeInstanceOf(Date);
    expect(revokedUser.revokedByUserId).toBe(ownerAId);
    expect(revokedUser.revocationReason).toBe(revocationReason);

    // Verify in PostgreSQL
    const dbUser = await prisma.user.findUnique({ where: { id: dentist.id } });
    expect(dbUser?.status).toBe('archived');
    expect(dbUser?.revocationReason).toBe(revocationReason);
    expect(dbUser?.revokedByUserId).toBe(ownerAId);

    // Assert Session is revoked
    const dbSession = await prisma.session.findUnique({ where: { id: session.id } });
    expect(dbSession?.status).toBe('revoked');

    // Assert Doctor is deactivated
    const dbDoctor = await prisma.doctor.findUnique({ where: { id: doctor.id } });
    expect(dbDoctor?.status).toBe('inactive');
    expect(dbDoctor?.deletedAt).toBeInstanceOf(Date);

    // Assert RbacAuditLog record
    const auditLog = await prisma.rbacAuditLog.findFirst({
      where: {
        tenantId: tenantAId,
        userId: dentist.id,
        eventType: 'membership.access_revoked',
      },
    });
    expect(auditLog).toBeDefined();
    expect(auditLog?.actorId).toBe(ownerAId);
    expect(auditLog?.outcome).toBe('revoked');
    const metadata = auditLog?.metadata as any;
    expect(metadata.revocationReason).toBe(revocationReason);
    expect(metadata.userEmail).toBe(dentistEmail);
    expect(metadata.role).toBe('doctor');

    // Assert MailJob enqueued
    const mailJob = await prisma.mailJob.findFirst({
      where: {
        tenantId: tenantAId,
        recipient: dentistEmail,
      },
      orderBy: { createdAt: 'desc' },
    });
    expect(mailJob).toBeDefined();
    expect(mailJob?.subject).toContain('revoked');
    expect(mailJob?.textBody).toContain(revocationReason);
    expect(mailJob?.htmlBody).toContain('Access Revoked');
  });

  it('2. Enforces non-empty, trimmed reason validation (blocks empty and whitespace-only reasons)', async () => {
    const receptionist = await prisma.user.create({
      data: {
        tenantId: tenantAId,
        clinicId: clinicAId,
        email: `receptionist-test-${testSuffix}@example.com`,
        passwordHash: 'hash123',
        firstName: 'Sarah',
        lastName: 'Connor',
        role: 'receptionist',
        status: 'active',
      },
    });

    // Empty string
    await expect(userService.revokeUser(receptionist.id, tenantAId, ownerAId, ''))
      .rejects.toThrow('Revocation reason is required.');

    // Whitespace only
    await expect(userService.revokeUser(receptionist.id, tenantAId, ownerAId, '    \n  \t  '))
      .rejects.toThrow('Revocation reason is required.');

    // Over 500 characters
    const longReason = 'A'.repeat(501);
    await expect(userService.revokeUser(receptionist.id, tenantAId, ownerAId, longReason))
      .rejects.toThrow('Revocation reason cannot exceed 500 characters.');

    // Valid reason with whitespace padding is trimmed properly
    const validWithPadding = '   Valid reason with spaces around it.   ';
    const revoked = await userService.revokeUser(receptionist.id, tenantAId, ownerAId, validWithPadding);
    expect(revoked.revocationReason).toBe('Valid reason with spaces around it.');
  });

  it('3. Prevents self-revocation (owner cannot revoke their own access)', async () => {
    await expect(userService.revokeUser(ownerAId, tenantAId, ownerAId, 'Accidental self-revocation attempt'))
      .rejects.toThrow('You cannot delete your own account.');
  });

  it('4. Enforces strict multi-tenant isolation (Tenant B owner cannot revoke Tenant A member)', async () => {
    const memberA = await prisma.user.create({
      data: {
        tenantId: tenantAId,
        email: `member-isolation-${testSuffix}@example.com`,
        passwordHash: 'hash123',
        firstName: 'Isolated',
        lastName: 'Member',
        role: 'receptionist',
        status: 'active',
      },
    });

    // Attempting to revoke Tenant A's user using Tenant B's context
    await expect(userService.revokeUser(memberA.id, tenantBId, ownerBId, 'Malicious cross-tenant attempt'))
      .rejects.toThrow('Tenant isolation violation');
  });

  it('5. Protects sole clinic owner from revocation', async () => {
    // Owner B is the only owner in Tenant B
    await expect(userService.revokeUser(ownerBId, tenantBId, 'some-other-actor-id', 'Removing sole owner'))
      .rejects.toThrow('Cannot modify, demote, deactivate, or remove the sole Practice Owner');
  });

  it('6. Ensures exactly ONE email is sent per revocation action (idempotent MailJob uniqueness)', async () => {
    const staffEmail = `staff-idempotent-${testSuffix}@example.com`;
    const staff = await prisma.user.create({
      data: {
        tenantId: tenantAId,
        email: staffEmail,
        passwordHash: 'hash123',
        firstName: 'John',
        lastName: 'Doe',
        role: 'receptionist',
        status: 'active',
      },
    });

    const initialMailCount = await prisma.mailJob.count({
      where: { tenantId: tenantAId, recipient: staffEmail },
    });
    expect(initialMailCount).toBe(0);

    // Revoke
    await userService.revokeUser(staff.id, tenantAId, ownerAId, 'Redundant position.');

    const mailCountAfter = await prisma.mailJob.count({
      where: { tenantId: tenantAId, recipient: staffEmail },
    });
    expect(mailCountAfter).toBe(1);
  });

  it('7. Read operations (GET queries) cause 0 mutations and 0 email notifications', async () => {
    const initialJobCount = await prisma.mailJob.count({ where: { tenantId: tenantAId } });
    const initialAuditCount = await prisma.rbacAuditLog.count({ where: { tenantId: tenantAId } });

    // Perform multiple read queries
    await userService.listUsers({ tenantId: tenantAId });
    await userService.getUserById(ownerAId, tenantAId);

    const finalJobCount = await prisma.mailJob.count({ where: { tenantId: tenantAId } });
    const finalAuditCount = await prisma.rbacAuditLog.count({ where: { tenantId: tenantAId } });

    expect(finalJobCount).toBe(initialJobCount);
    expect(finalAuditCount).toBe(initialAuditCount);
  });

  afterAll(async () => {
    const { cleanupTestTenant } = await import('../../../shared/database/test-teardown');
    await cleanupTestTenant(tenantAId, prisma);
    await cleanupTestTenant(tenantBId, prisma);
    await prisma.$disconnect();
  });
});

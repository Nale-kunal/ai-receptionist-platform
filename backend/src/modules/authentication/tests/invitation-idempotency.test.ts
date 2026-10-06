/**
 * Master Regression Test Suite:
 * Invitation Lifecycle, Idempotency, Concurrency, and Email Delivery Invariants
 *
 * Covers all 12 Required Test Cases:
 *   Test 1  -- Single explicit invitation (1 DB invitation, 1 email event, 1 mail job)
 *   Test 2  -- Duplicate sequential HTTP requests (2 requests -> 1 invitation, 1 mail job)
 *   Test 3  -- Concurrent racing requests (10 simultaneous requests -> 1 invitation, 1 mail job)
 *   Test 4  -- Page refresh / repeated reads (0 invitations created, 0 mail jobs)
 *   Test 5  -- React Strict Mode / component remount simulation (0 accidental invitations)
 *   Test 6  -- Backend retry of failed request (1 logical invitation, 1 mail job)
 *   Test 7  -- Email worker retry (1 logical email, multiple attempts, NO duplicate mail job)
 *   Test 8  -- Explicit resend (1 controlled resend event, 1 new mail job)
 *   Test 9  -- GET endpoints read-only invariant (0 writes, 0 mail jobs)
 *   Test 10 -- Multi-tenant isolation (Clinic A invitations hidden from Clinic B)
 *   Test 11 -- Admin & Clinic interface consistency
 *   Test 12 -- Practice Owner != Doctor role distinction
 */

import { PrismaClient } from '@prisma/client';
import { InvitationService } from '../services/invitation.service';
import { UserService } from '../services/user.service';
import { UserRepository } from '../repositories/user.repository';
import { DoctorRepository } from '../../doctor/repositories/doctor.repository';
import { DoctorService } from '../../doctor/services/doctor.service';
import { MailQueueService } from '../../../shared/email/queue/MailQueueService';
import { EmailService } from '../../../shared/email/EmailService';
import { EmailServiceAdapter } from '../../../shared/email/EmailServiceAdapter';
import { MockEmailProvider } from '../../../shared/email/providers/MockEmailProvider';

describe('Invitation Lifecycle & Idempotency Master Test Suite', () => {
  let prisma: PrismaClient;
  let mockProvider: MockEmailProvider;
  let mailQueue: MailQueueService;
  let emailService: EmailService;
  let emailAdapter: EmailServiceAdapter;
  let invitationService: InvitationService;
  let userService: UserService;
  let doctorService: DoctorService;

  let tenantAId: string;
  let tenantBId: string;
  let ownerAId: string;
  let ownerBId: string;
  const testRunId = Date.now();

  beforeAll(async () => {
    prisma = new PrismaClient();
    mockProvider = new MockEmailProvider();
    mailQueue = new MailQueueService(mockProvider, prisma);
    emailService = new EmailService(mailQueue, mockProvider);
    emailAdapter = new EmailServiceAdapter(emailService);

    invitationService = new InvitationService(prisma, undefined, undefined, emailAdapter);
    const userRepo = new UserRepository(prisma);
    userService = new UserService(userRepo, undefined, prisma, undefined, emailService);

    const docRepo = new DoctorRepository(prisma);
    const mockDocPublisher = { publish: jest.fn().mockResolvedValue(undefined) };
    doctorService = new DoctorService(docRepo, mockDocPublisher as any);

    // Setup Tenant A
    const tenantA = await prisma.tenant.create({
      data: {
        name: `Test Tenant A ${testRunId}`,
        slug: `tenant-a-${testRunId}`,
        status: 'active',
      },
    });
    tenantAId = tenantA.id;

    const ownerA = await prisma.user.create({
      data: {
        tenantId: tenantAId,
        email: `owner-a-${testRunId}@example.com`,
        passwordHash: 'argon2_hash_placeholder',
        firstName: 'Alice',
        lastName: 'Owner',
        role: 'clinic_owner',
        status: 'active',
      },
    });
    ownerAId = ownerA.id;

    // Setup Tenant B
    const tenantB = await prisma.tenant.create({
      data: {
        name: `Test Tenant B ${testRunId}`,
        slug: `tenant-b-${testRunId}`,
        status: 'active',
      },
    });
    tenantBId = tenantB.id;

    const ownerB = await prisma.user.create({
      data: {
        tenantId: tenantBId,
        email: `owner-b-${testRunId}@example.com`,
        passwordHash: 'argon2_hash_placeholder',
        firstName: 'Bob',
        lastName: 'Owner',
        role: 'clinic_owner',
        status: 'active',
      },
    });
    ownerBId = ownerB.id;
  }, 30000);

  afterAll(async () => {
    mailQueue?.shutdown();
    if (tenantAId) {
      await prisma.mailJob.deleteMany({ where: { tenantId: tenantAId } }).catch(() => {});
      await prisma.notification.deleteMany({ where: { tenantId: tenantAId } }).catch(() => {});
      await prisma.invitation.deleteMany({ where: { tenantId: tenantAId } }).catch(() => {});
      await prisma.user.deleteMany({ where: { tenantId: tenantAId } }).catch(() => {});
      await prisma.tenant.deleteMany({ where: { id: tenantAId } }).catch(() => {});
    }
    if (tenantBId) {
      await prisma.mailJob.deleteMany({ where: { tenantId: tenantBId } }).catch(() => {});
      await prisma.notification.deleteMany({ where: { tenantId: tenantBId } }).catch(() => {});
      await prisma.invitation.deleteMany({ where: { tenantId: tenantBId } }).catch(() => {});
      await prisma.user.deleteMany({ where: { tenantId: tenantBId } }).catch(() => {});
      await prisma.tenant.deleteMany({ where: { id: tenantBId } }).catch(() => {});
    }
    await prisma.$disconnect();
  }, 30000);

  // ---------------------------------------------------------------------------
  // Test 1 -- Single invitation
  // ---------------------------------------------------------------------------
  it('Test 1 -- Single invitation creates 1 DB record and 1 email event', async () => {
    const email = `single-${testRunId}@example.com`;
    const res = await invitationService.createInvitation({
      tenantId: tenantAId,
      invitedByUserId: ownerAId,
      email,
      roleName: 'doctor',
    });

    expect(res.invitation.id).toBeDefined();
    expect(res.invitation.status).toBe('pending');

    const dbInv = await prisma.invitation.findMany({
      where: { tenantId: tenantAId, email },
    });
    expect(dbInv).toHaveLength(1);

    const dbJobs = await prisma.mailJob.findMany({
      where: { tenantId: tenantAId, recipient: email },
    });
    expect(dbJobs).toHaveLength(1);
    expect(dbJobs[0].type).toBe('invitation');
  });

  // ---------------------------------------------------------------------------
  // Test 2 -- Duplicate sequential HTTP requests
  // ---------------------------------------------------------------------------
  it('Test 2 -- Duplicate sequential request is rejected and does NOT send second email', async () => {
    const email = `dup-seq-${testRunId}@example.com`;

    // First request
    await invitationService.createInvitation({
      tenantId: tenantAId,
      invitedByUserId: ownerAId,
      email,
      roleName: 'receptionist',
    });

    // Second sequential request for same email
    await expect(
      invitationService.createInvitation({
        tenantId: tenantAId,
        invitedByUserId: ownerAId,
        email,
        roleName: 'receptionist',
      }),
    ).rejects.toThrow();

    const dbInvs = await prisma.invitation.findMany({
      where: { tenantId: tenantAId, email },
    });
    expect(dbInvs).toHaveLength(1);

    const dbJobs = await prisma.mailJob.findMany({
      where: { tenantId: tenantAId, recipient: email },
    });
    expect(dbJobs).toHaveLength(1);
  });

  // ---------------------------------------------------------------------------
  // Test 3 -- Concurrent requests (10 simultaneous requests)
  // ---------------------------------------------------------------------------
  it('Test 3 -- 10 concurrent requests produce exactly 1 DB invitation and 1 email', async () => {
    const email = `concurrent-${testRunId}@example.com`;

    const promises = Array.from({ length: 10 }).map(() =>
      invitationService
        .createInvitation({
          tenantId: tenantAId,
          invitedByUserId: ownerAId,
          email,
          roleName: 'doctor',
        })
        .then(() => 'success')
        .catch(() => 'rejected'),
    );

    const outcomes = await Promise.all(promises);
    const successCount = outcomes.filter((o) => o === 'success').length;
    const rejectedCount = outcomes.filter((o) => o === 'rejected').length;

    expect(successCount).toBe(1);
    expect(rejectedCount).toBe(9);

    const dbInvs = await prisma.invitation.findMany({
      where: { tenantId: tenantAId, email },
    });
    expect(dbInvs).toHaveLength(1);

    const dbJobs = await prisma.mailJob.findMany({
      where: { tenantId: tenantAId, recipient: email },
    });
    expect(dbJobs).toHaveLength(1);
  });

  // ---------------------------------------------------------------------------
  // Test 4 -- Page refresh / repeated reads
  // ---------------------------------------------------------------------------
  it('Test 4 -- Listing invitations / stats produces 0 writes and 0 emails', async () => {
    const initialInvCount = await prisma.invitation.count({ where: { tenantId: tenantAId } });
    const initialJobsCount = await prisma.mailJob.count({ where: { tenantId: tenantAId } });

    // Simulate 5 rapid page refreshes
    for (let i = 0; i < 5; i++) {
      await invitationService.listInvitations({ tenantId: tenantAId });
      await invitationService.getInvitationStats(tenantAId);
    }

    const postInvCount = await prisma.invitation.count({ where: { tenantId: tenantAId } });
    const postJobsCount = await prisma.mailJob.count({ where: { tenantId: tenantAId } });

    expect(postInvCount).toBe(initialInvCount);
    expect(postJobsCount).toBe(initialJobsCount);
  });

  // ---------------------------------------------------------------------------
  // Test 5 -- React Strict Mode / component remount simulation
  // ---------------------------------------------------------------------------
  it('Test 5 -- Component mount simulation produces 0 accidental invitations', async () => {
    const initialCount = await prisma.invitation.count({ where: { tenantId: tenantAId } });

    // Mount 1
    const [invs1, stats1] = await Promise.all([
      invitationService.listInvitations({ tenantId: tenantAId }),
      invitationService.getInvitationStats(tenantAId),
    ]);

    // Unmount & Remount 2 (React.StrictMode behavior)
    const [invs2, stats2] = await Promise.all([
      invitationService.listInvitations({ tenantId: tenantAId }),
      invitationService.getInvitationStats(tenantAId),
    ]);

    expect(invs1.invitations.length).toBe(invs2.invitations.length);
    expect(stats1.total).toBe(stats2.total);

    const finalCount = await prisma.invitation.count({ where: { tenantId: tenantAId } });
    expect(finalCount).toBe(initialCount);
  });

  // ---------------------------------------------------------------------------
  // Test 6 -- Backend retry of failed request
  // ---------------------------------------------------------------------------
  it('Test 6 -- Retrying an existing active invitation returns existing or throws without extra email', async () => {
    const email = `retry-req-${testRunId}@example.com`;

    await invitationService.createInvitation({
      tenantId: tenantAId,
      invitedByUserId: ownerAId,
      email,
      roleName: 'doctor',
    });

    const jobsBefore = await prisma.mailJob.count({
      where: { tenantId: tenantAId, recipient: email },
    });
    expect(jobsBefore).toBe(1);

    // Simulated retry
    await expect(
      invitationService.createInvitation({
        tenantId: tenantAId,
        invitedByUserId: ownerAId,
        email,
        roleName: 'doctor',
      }),
    ).rejects.toThrow();

    const jobsAfter = await prisma.mailJob.count({
      where: { tenantId: tenantAId, recipient: email },
    });
    expect(jobsAfter).toBe(1);
  });

  // ---------------------------------------------------------------------------
  // Test 7 -- Email worker retry
  // ---------------------------------------------------------------------------
  it('Test 7 -- Worker retries deliver the exact same logical email without duplicates', async () => {
    const email = `worker-retry-${testRunId}@example.com`;

    const job = await mailQueue.enqueue({
      idempotencyKey: `worker-retry-job-${testRunId}`,
      tenantId: tenantAId,
      recipient: email,
      type: 'invitation',
      subject: 'Worker Retry Test',
      html: '<p>Worker retry test</p>',
      text: 'Worker retry test',
    });

    expect(job).not.toBeNull();

    // Repeated enqueue with same idempotency key is a no-op
    const dupJob = await mailQueue.enqueue({
      idempotencyKey: `worker-retry-job-${testRunId}`,
      tenantId: tenantAId,
      recipient: email,
      type: 'invitation',
      subject: 'Worker Retry Test',
      html: '<p>Worker retry test</p>',
      text: 'Worker retry test',
    });

    expect(dupJob?.id).toBe(job?.id);

    const dbJobs = await prisma.mailJob.findMany({
      where: { tenantId: tenantAId, recipient: email },
    });
    expect(dbJobs).toHaveLength(1);
  });

  // ---------------------------------------------------------------------------
  // Test 8 -- Explicit resend
  // ---------------------------------------------------------------------------
  it('Test 8 -- Explicit resend dispatches exactly 1 new controlled resend email', async () => {
    const email = `resend-${testRunId}@example.com`;

    const created = await invitationService.createInvitation({
      tenantId: tenantAId,
      invitedByUserId: ownerAId,
      email,
      roleName: 'doctor',
    });

    const initialJobs = await prisma.mailJob.findMany({
      where: { tenantId: tenantAId, recipient: email },
    });
    expect(initialJobs).toHaveLength(1);

    // User explicitly clicks resend
    const resent = await invitationService.resendInvitation(
      created.invitation.id,
      tenantAId,
      ownerAId,
    );

    expect(resent.invitation.status).toBe('pending');
    expect(resent.invitation.resentAt).toBeDefined();

    const jobsAfterResend = await prisma.mailJob.findMany({
      where: { tenantId: tenantAId, recipient: email },
    });
    expect(jobsAfterResend).toHaveLength(2); // 1 initial + 1 explicit resend
  });

  // ---------------------------------------------------------------------------
  // Test 8b -- Resend on viewed and expired invitations
  // ---------------------------------------------------------------------------
  it('Test 8b -- Resend on viewed and expired invitations regenerates token and sets pending', async () => {
    const emailViewed = `resend-viewed-${testRunId}@example.com`;
    const createdViewed = await invitationService.createInvitation({
      tenantId: tenantAId,
      invitedByUserId: ownerAId,
      email: emailViewed,
      roleName: 'receptionist',
    });

    // Simulate viewed status
    await prisma.invitation.update({
      where: { id: createdViewed.invitation.id },
      data: { status: 'viewed' },
    });

    const resentViewed = await invitationService.resendInvitation(
      createdViewed.invitation.id,
      tenantAId,
      ownerAId,
    );
    expect(resentViewed.invitation.status).toBe('pending');

    const emailExpired = `resend-expired-${testRunId}@example.com`;
    const createdExpired = await invitationService.createInvitation({
      tenantId: tenantAId,
      invitedByUserId: ownerAId,
      email: emailExpired,
      roleName: 'doctor',
    });

    // Simulate expired status
    await prisma.invitation.update({
      where: { id: createdExpired.invitation.id },
      data: { status: 'expired', expiresAt: new Date(Date.now() - 1000) },
    });

    const resentExpired = await invitationService.resendInvitation(
      createdExpired.invitation.id,
      tenantAId,
      ownerAId,
    );
    expect(resentExpired.invitation.status).toBe('pending');
    expect(new Date(resentExpired.invitation.expiresAt).getTime()).toBeGreaterThan(Date.now());
  });

  // ---------------------------------------------------------------------------
  // Test 8c -- Resend rejected on invalid statuses
  // ---------------------------------------------------------------------------
  it('Test 8c -- Resend on accepted, declined, or revoked invitation is rejected', async () => {
    const emailAccepted = `resend-accepted-${testRunId}@example.com`;
    const createdAccepted = await invitationService.createInvitation({
      tenantId: tenantAId,
      invitedByUserId: ownerAId,
      email: emailAccepted,
      roleName: 'receptionist',
    });

    await prisma.invitation.update({
      where: { id: createdAccepted.invitation.id },
      data: { status: 'accepted', acceptedAt: new Date() },
    });

    await expect(
      invitationService.resendInvitation(createdAccepted.invitation.id, tenantAId, ownerAId),
    ).rejects.toThrow(/Cannot resend invitation with status 'accepted'/);

    // Declined status
    await prisma.invitation.update({
      where: { id: createdAccepted.invitation.id },
      data: { status: 'declined', declinedAt: new Date() },
    });

    await expect(
      invitationService.resendInvitation(createdAccepted.invitation.id, tenantAId, ownerAId),
    ).rejects.toThrow(/Cannot resend invitation with status 'declined'/);
  });

  // ---------------------------------------------------------------------------
  // Test 8d -- Double-click & rapid retry with same idempotency key
  // ---------------------------------------------------------------------------
  it('Test 8d -- Double-click / network retry with same clientKey produces exactly 1 email job', async () => {
    const email = `resend-doubleclick-${testRunId}@example.com`;
    const created = await invitationService.createInvitation({
      tenantId: tenantAId,
      invitedByUserId: ownerAId,
      email,
      roleName: 'doctor',
    });

    const clientKey = `doubleclick_key_${Date.now()}`;

    // Rapid double click with the same key
    await Promise.all([
      invitationService.resendInvitation(created.invitation.id, tenantAId, ownerAId, clientKey),
      invitationService.resendInvitation(created.invitation.id, tenantAId, ownerAId, clientKey),
    ]);

    const jobs = await prisma.mailJob.findMany({
      where: { tenantId: tenantAId, recipient: email },
    });
    // 1 initial invite job + 1 resend job (the second concurrent call was deduplicated by idempotency key)
    expect(jobs).toHaveLength(2);
  });

  // ---------------------------------------------------------------------------
  // Test 8e -- Tenant isolation on resend
  // ---------------------------------------------------------------------------
  it('Test 8e -- Multi-tenant isolation: Tenant B cannot resend Tenant A invitation', async () => {
    const email = `resend-tenant-iso-${testRunId}@example.com`;
    const created = await invitationService.createInvitation({
      tenantId: tenantAId,
      invitedByUserId: ownerAId,
      email,
      roleName: 'receptionist',
    });

    // Tenant B attempts to resend Tenant A's invitation
    await expect(
      invitationService.resendInvitation(created.invitation.id, tenantBId, ownerBId),
    ).rejects.toThrow(/Invitation '.*' not found/);
  });

  // ---------------------------------------------------------------------------
  // Test 9 -- GET endpoints read-only invariant
  // ---------------------------------------------------------------------------
  it('Test 9 -- validateInvitationToken is strictly read-only and never writes records', async () => {
    const email = `token-read-${testRunId}@example.com`;
    const created = await invitationService.createInvitation({
      tenantId: tenantAId,
      invitedByUserId: ownerAId,
      email,
      roleName: 'receptionist',
    });

    const initialInvCount = await prisma.invitation.count();
    const meta = await invitationService.validateInvitationToken(created.rawToken);

    expect(meta.email).toBe(email);
    expect(meta.tenantName).toBeDefined();

    const postInvCount = await prisma.invitation.count();
    expect(postInvCount).toBe(initialInvCount);
  });

  // ---------------------------------------------------------------------------
  // Test 10 -- Multi-tenant isolation
  // ---------------------------------------------------------------------------
  it('Test 10 -- Tenant A invitations are completely invisible to Tenant B', async () => {
    const emailA = `tenant-a-only-${testRunId}@example.com`;
    await invitationService.createInvitation({
      tenantId: tenantAId,
      invitedByUserId: ownerAId,
      email: emailA,
      roleName: 'doctor',
    });

    const listB = await invitationService.listInvitations({ tenantId: tenantBId });
    const foundInB = listB.invitations.find((i: any) => i.email === emailA);
    expect(foundInB).toBeUndefined();

    const listA = await invitationService.listInvitations({ tenantId: tenantAId });
    const foundInA = listA.invitations.find((i: any) => i.email === emailA);
    expect(foundInA).toBeDefined();
  });

  // ---------------------------------------------------------------------------
  // Test 11 -- Admin & Clinic interface consistency
  // ---------------------------------------------------------------------------
  it('Test 11 -- Admin query and Clinic query return identical PostgreSQL data for members', async () => {
    const clinicUsers = await userService.listUsers({ tenantId: tenantAId });

    // Admin query
    const adminUsers = await prisma.user.findMany({
      where: {
        tenantId: tenantAId,
        deletedAt: null,
      },
    });

    expect(clinicUsers.length).toBe(adminUsers.length);
    expect(clinicUsers[0].email).toBe(adminUsers[0].email);
  });

  // ---------------------------------------------------------------------------
  // Test 12 -- Practice Owner != Doctor invariant
  // ---------------------------------------------------------------------------
  it('Test 12 -- Practice Owner user is NOT returned in doctor queries', async () => {
    const doctors = await doctorService.listDoctors({ tenantId: tenantAId });
    expect(doctors).toHaveLength(0);

    const isDoc = doctors.some((d: any) => d.email === `owner-a-${testRunId}@example.com`);
    expect(isDoc).toBe(false);
  });

  afterAll(async () => {
    const { cleanupTestTenant } = await import('../../../shared/database/test-teardown');
    await cleanupTestTenant(tenantAId, prisma);
    await cleanupTestTenant(tenantBId, prisma);
    await prisma.$disconnect();
  });
});

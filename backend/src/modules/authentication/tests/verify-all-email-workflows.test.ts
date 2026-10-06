import { PrismaClient } from '@prisma/client';
import { ResendEmailProvider } from '../../../shared/email/providers/ResendEmailProvider';
import { MailQueueService } from '../../../shared/email/queue/MailQueueService';
import { EmailService } from '../../../shared/email/EmailService';
import { EmailServiceAdapter } from '../../../shared/email/EmailServiceAdapter';
import { InvitationService } from '../services/invitation.service';
import { UserService } from '../services/user.service';
import { UserRepository } from '../repositories/user.repository';

describe('Live End-to-End Notification & Delivery Integration Audit', () => {
  let prisma: PrismaClient;
  let provider: ResendEmailProvider;
  let mailQueue: MailQueueService;
  let emailService: EmailService;
  let emailAdapter: EmailServiceAdapter;
  let invitationService: InvitationService;
  let userService: UserService;

  let tenantId: string;
  let ownerId: string;
  let memberId: string;
  const timestamp = Date.now();

  beforeAll(async () => {
    prisma = new PrismaClient();
    const apiKey = process.env['RESEND_API_KEY'] || 're_mock_test_key_0000000000000000';
    provider = new ResendEmailProvider(apiKey, '"Dental AI" <onboarding@resend.dev>');
    mailQueue = new MailQueueService(provider, prisma);
    await mailQueue.initialize();
    emailService = new EmailService(mailQueue, provider);
    emailAdapter = new EmailServiceAdapter(emailService);

    invitationService = new InvitationService(prisma, undefined, undefined, emailAdapter);
    const userRepo = new UserRepository(prisma);
    userService = new UserService(userRepo, undefined, prisma, undefined, emailService);

    // Create test tenant and users in DB
    const tenant = await prisma.tenant.create({
      data: {
        name: `Live Audit Clinic ${timestamp}`,
        slug: `audit-clinic-${timestamp}`,
        status: 'active',
      },
    });
    tenantId = tenant.id;

    await prisma.notification.deleteMany({ where: { tenantId } });
    await prisma.mailJob.deleteMany({ where: { tenantId } });

    const owner = await prisma.user.create({
      data: {
        tenantId,
        email: `owner-${timestamp}@example.com`,
        passwordHash: 'argon2_hash_placeholder',
        firstName: 'Alice',
        lastName: 'Owner',
        role: 'clinic_owner',
        status: 'active',
      },
    });
    ownerId = owner.id;

    const member = await prisma.user.create({
      data: {
        tenantId,
        email: `member-${timestamp}@example.com`,
        passwordHash: 'argon2_hash_placeholder',
        firstName: 'Bob',
        lastName: 'Dentist',
        role: 'doctor',
        status: 'active',
      },
    });
    memberId = member.id;
  }, 30000);

  afterAll(async () => {
    mailQueue?.shutdown();
    if (tenantId) {
      await prisma.notification.deleteMany({ where: { tenantId } }).catch(() => {});
      await prisma.invitation.deleteMany({ where: { tenantId } }).catch(() => {});
      await prisma.user.deleteMany({ where: { tenantId } }).catch(() => {});
      await prisma.tenant.deleteMany({ where: { id: tenantId } }).catch(() => {});
    }
    await prisma.$disconnect();
  }, 30000);

  async function waitForDeliveredNotification(whereClause: any) {
    for (let i = 0; i < 15; i++) {
      await mailQueue.processQueue();
      const ntf = await prisma.notification.findFirst({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
      });
      if (ntf && ntf.status === 'delivered') return ntf;
      await new Promise((r) => setTimeout(r, 300));
    }
    return await prisma.notification.findFirst({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
    });
  }

  it('1. should create New User Invitation, persist DB Notification record, and deliver via Resend API', async () => {
    const email = `newuser-${timestamp}@example.com`;
    const res = await invitationService.createInvitation({
      tenantId,
      invitedByUserId: ownerId,
      email,
      roleName: 'doctor',
    });

    expect(res.invitation.type).toBe('new_user');
    expect(res.inviteLink).toContain('/invite/accept?token=');

    const ntf = await waitForDeliveredNotification({ tenantId, recipient: email });
    expect(ntf).not.toBeNull();
    expect(ntf?.status).toBe('delivered');
  }, 20000);

  it('2. should create Existing User Role Assignment Invitation, persist DB Notification, and deliver email', async () => {
    const otherTenant = await prisma.tenant.create({
      data: { name: `Other ${timestamp}`, slug: `other-${timestamp}`, status: 'active' },
    });
    const existingOther = await prisma.user.create({
      data: {
        tenantId: otherTenant.id,
        email: `otheruser-${timestamp}@example.com`,
        passwordHash: 'placeholder',
        firstName: 'Charlie',
        lastName: 'Staff',
        role: 'receptionist',
        status: 'active',
      },
    });

    const res = await invitationService.createInvitation({
      tenantId,
      invitedByUserId: ownerId,
      email: existingOther.email,
      roleName: 'receptionist',
    });

    expect(res.invitation.type).toBe('role_assignment');
    expect(res.inviteLink).toContain('/invite/review?token=');

    const ntf = await waitForDeliveredNotification({ tenantId, recipient: existingOther.email });
    expect(ntf).not.toBeNull();
    expect(ntf?.status).toBe('delivered');

    // Cleanup extra tenant
    await prisma.user.deleteMany({ where: { tenantId: otherTenant.id } });
    await prisma.tenant.deleteMany({ where: { id: otherTenant.id } });
  }, 20000);

  it('3. should create Existing User Role Change Invitation, persist DB Notification, and deliver email', async () => {
    const res = await invitationService.createInvitation({
      tenantId,
      invitedByUserId: ownerId,
      email: `member-${timestamp}@example.com`,
      roleName: 'clinic_owner',
    });

    expect(res.invitation.type).toBe('role_change');
    expect(res.invitation.currentRoleName).toBe('doctor');

    const ntf = await waitForDeliveredNotification({ tenantId, recipient: `member-${timestamp}@example.com` });
    expect(ntf).not.toBeNull();
    expect(ntf?.status).toBe('delivered');
  }, 20000);

  it('4. should trigger email notification and persist DB record on direct Role Update via UserService', async () => {
    await userService.updateUser({
      id: memberId,
      tenantId,
      role: 'receptionist',
      actorUserId: ownerId,
    });

    const ntf = await waitForDeliveredNotification({ tenantId, recipient: `member-${timestamp}@example.com`, type: 'invitation' });
    expect(ntf).not.toBeNull();
    expect(ntf?.status).toBe('delivered');
  }, 20000);

  it('5. should trigger email notification and persist DB record on Ownership Transfer', async () => {
    await userService.transferOwnership({
      tenantId,
      actorUserId: ownerId,
      targetUserId: memberId,
    });

    const ntf = await waitForDeliveredNotification({ tenantId, recipient: `member-${timestamp}@example.com`, subject: { contains: 'Ownership Transferred' } });
    expect(ntf).not.toBeNull();
    expect(ntf?.status).toBe('delivered');
  }, 20000);

  it('6. should trigger email notification and persist DB record on User Removal', async () => {
    await userService.deleteUser(memberId, tenantId, ownerId);

    const ntf = await waitForDeliveredNotification({ tenantId, recipient: `member-${timestamp}@example.com`, subject: { contains: 'revoked' } });
    expect(ntf).not.toBeNull();
    expect(ntf?.status).toBe('delivered');
  }, 20000);

  afterAll(async () => {
    await mailQueue.shutdown();
    const { cleanupTestTenant } = await import('../../../shared/database/test-teardown');
    await cleanupTestTenant(tenantId, prisma);
    await prisma.$disconnect();
  });
});

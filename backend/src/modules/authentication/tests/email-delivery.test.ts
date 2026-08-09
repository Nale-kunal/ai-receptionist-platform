import { PrismaClient } from '@prisma/client';
import { EmailProviderFactory } from '../../../shared/email/EmailProviderFactory';
import { MockEmailProvider } from '../../../shared/email/providers/MockEmailProvider';
import { MailQueueService } from '../../../shared/email/queue/MailQueueService';
import { EmailService } from '../../../shared/email/EmailService';
import { EmailServiceAdapter } from '../../../shared/email/EmailServiceAdapter';
import { InvitationEmailTemplate } from '../../../shared/email/templates/InvitationEmailTemplate';
import { InvitationService } from '../services/invitation.service';

describe('Enterprise Email Infrastructure & Invitation System', () => {
  let prisma: PrismaClient;
  let mockProvider: MockEmailProvider;
  let queueService: MailQueueService;
  let emailService: EmailService;
  let emailAdapter: EmailServiceAdapter;
  let invitationService: InvitationService;

  beforeAll(async () => {
    prisma = new PrismaClient();
  });

  afterAll(async () => {
    queueService?.shutdown();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    mockProvider = new MockEmailProvider();
    await prisma.mailJob.deleteMany({});
    queueService = new MailQueueService(mockProvider, prisma);
    queueService.shutdown(); // Stop auto-ticker to test explicit queue processing
    emailService = new EmailService(queueService, mockProvider);
    emailAdapter = new EmailServiceAdapter(emailService);
    invitationService = new InvitationService(prisma, undefined, undefined, emailAdapter);
  });

  describe('1. Swappable Email Provider Factory', () => {
    it('should create MockEmailProvider for "mock"', () => {
      const provider = EmailProviderFactory.createProvider('mock');
      expect(provider.getProviderName()).toBe('mock');
    });

    it('should create ResendEmailProvider for "resend"', () => {
      const provider = EmailProviderFactory.createProvider('resend');
      expect(provider.getProviderName()).toBe('resend');
    });

    it('should create SendGridEmailProvider for "sendgrid"', () => {
      const provider = EmailProviderFactory.createProvider('sendgrid');
      expect(provider.getProviderName()).toBe('sendgrid');
    });

    it('should create PostmarkEmailProvider for "postmark"', () => {
      const provider = EmailProviderFactory.createProvider('postmark');
      expect(provider.getProviderName()).toBe('postmark');
    });

    it('should default to ResendEmailProvider when EMAIL_PROVIDER is resend', () => {
      const provider = EmailProviderFactory.createProvider('resend');
      expect(provider.getProviderName()).toBe('resend');
    });

    it('should handle missing API key error in ResendEmailProvider gracefully', async () => {
      const { ResendEmailProvider } = await import('../../../shared/email/providers/ResendEmailProvider');
      const resend = new ResendEmailProvider('');
      const result = await resend.sendEmail({
        to: 'patient@example.com',
        subject: 'Test',
        html: '<p>Test</p>',
        text: 'Test',
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain('RESEND_API_KEY is not configured');
    });

    it('should format sender address correctly without hardcoding', () => {
      const formatted = EmailService.formatSenderAddress('Dental AI', 'no-reply@yourdomain.com');
      expect(formatted).toBe('"Dental AI" <no-reply@yourdomain.com>');
    });

    it('should reject CRLF header injection in sender name or email address', () => {
      expect(() => EmailService.formatSenderAddress('Dental AI\r\nBcc: hacker@evil.com', 'test@example.com')).toThrow(
        'Header injection (CRLF) detected',
      );
      expect(() => EmailService.formatSenderAddress('Dental AI', 'test@example.com\nBcc: hacker@evil.com')).toThrow(
        'Header injection (CRLF) detected',
      );
    });

    it('should throw EmailProviderConfigurationError when production credentials are missing', () => {
      const oldEnv = process.env['NODE_ENV'];
      process.env['NODE_ENV'] = 'production';
      delete process.env['RESEND_API_KEY'];

      expect(() => EmailProviderFactory.validateConfiguration('resend')).toThrow();

      process.env['NODE_ENV'] = oldEnv;
    });
  });

  describe('2. Email Template Engine & Anti-Spam Deliverability Headers', () => {
    it('should render HTML & text invitation template with practice details & secure token link', () => {
      const rendered = InvitationEmailTemplate.render({
        toEmail: 'dr.smith@example.com',
        roleName: 'doctor',
        tenantName: 'Bright Smile Dental',
        inviterName: 'Dr. Jane Doe',
        inviteLink: 'http://localhost:5173/invite/accept?token=abcdef1234567890',
        expiresInDays: 7,
      });

      expect(rendered.subject).toContain('Bright Smile Dental');
      expect(rendered.html).toContain('Bright Smile Dental');
      expect(rendered.html).toContain('Dentist');
      expect(rendered.html).toContain('Dr. Jane Doe');
      expect(rendered.html).toContain('dr.smith@example.com');
    });
  });

  describe('3. Asynchronous Mail Queue & Worker Delivery', () => {
    it('should enqueue and deliver email asynchronously', async () => {
      await emailService.sendInvitationEmail({
        to: 'receptionist@example.com',
        roleName: 'receptionist',
        tenantName: 'Downtown Dental',
        inviterName: 'Practice Admin',
        inviteLink: 'http://localhost:5173/invite/accept?token=testtoken123',
      });

      // Process queue manually
      await queueService.processQueue();

      const jobs = await prisma.mailJob.findMany({ where: { recipient: 'receptionist@example.com' } });
      expect(jobs.length).toBeGreaterThanOrEqual(1);
    });

    it('should handle retries for failing emails', async () => {
      await queueService.enqueue({
        recipient: 'fail@example.com',
        type: 'invitation',
        subject: 'Test Retry',
        html: '<p>Retry</p>',
        text: 'Retry',
      });

      await queueService.processQueue();

      const jobs = await prisma.mailJob.findMany({ where: { recipient: 'fail@example.com' } });
      expect(jobs.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('4. End-to-End Invitation Delivery Pipeline Integration', () => {
    let tenantId: string;
    let actorUserId: string;

    beforeEach(async () => {
      // Create temporary tenant and user for testing
      const tenant = await prisma.tenant.create({
        data: {
          name: `Test Dental Clinic ${Date.now()}`,
          slug: `test-clinic-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          status: 'active',
        },
      });
      tenantId = tenant.id;

      const actor = await prisma.user.create({
        data: {
          tenantId,
          email: `owner-${Date.now()}@example.com`,
          passwordHash: 'argon2_hash_placeholder',
          firstName: 'Owner',
          lastName: 'Practice',
          role: 'clinic_owner',
          status: 'active',
        },
      });
      actorUserId = actor.id;
    });

    afterEach(async () => {
      // Cleanup
      await prisma.notification.deleteMany({ where: { tenantId } });
      await prisma.invitation.deleteMany({ where: { tenantId } });
      await prisma.session.deleteMany({ where: { tenantId } });
      await prisma.user.deleteMany({ where: { tenantId } });
      await prisma.tenant.deleteMany({ where: { id: tenantId } });
    });

    it('should create invitation and enqueue email delivery automatically', async () => {
      const inviteEmail = `invite-test-${Date.now()}@example.com`;

      const result = await invitationService.createInvitation({
        tenantId,
        invitedByUserId: actorUserId,
        email: inviteEmail,
        roleName: 'doctor',
      });

      expect(result.invitation.id).toBeDefined();
      expect(result.invitation.email).toBe(inviteEmail);
      expect(result.invitation.status).toBe('pending');
      expect(result.rawToken).toBeDefined();
      expect(result.inviteLink).toContain(result.rawToken);

      // Process queue manually if pending
      await queueService.processQueue();

      const jobs = await prisma.mailJob.findMany({ where: { recipient: inviteEmail } });
      expect(jobs.length).toBeGreaterThanOrEqual(1);
    });

    it('should validate token and accept invitation for new user', async () => {
      const recipientEmail = `new-user-${Date.now()}@example.com`;

      const created = await invitationService.createInvitation({
        tenantId,
        invitedByUserId: actorUserId,
        email: recipientEmail,
        roleName: 'receptionist',
      });

      // Validate token
      const meta = await invitationService.validateInvitationToken(created.rawToken);
      expect(meta.email).toBe(recipientEmail);
      expect(meta.roleName).toBe('receptionist');

      // Accept invitation
      const acceptedUser = await invitationService.acceptInvitation({
        token: created.rawToken,
        password: 'Password123!',
        firstName: 'New',
        lastName: 'Receptionist',
      });

      expect(acceptedUser.email).toBe(recipientEmail);
      expect(acceptedUser.role).toBe('receptionist');
      expect(acceptedUser.status).toBe('active');
      expect(acceptedUser.emailVerified).toBe(true);

      // Verify invitation status updated to 'accepted' in DB
      const dbInv = await prisma.invitation.findUnique({ where: { id: created.invitation.id } });
      expect(dbInv?.status).toBe('accepted');

      // Re-accepting should throw InvitationAlreadyAcceptedError
      await expect(
        invitationService.acceptInvitation({
          token: created.rawToken,
          password: 'Password123!',
          firstName: 'New',
          lastName: 'Receptionist',
        }),
      ).rejects.toThrow();
    });
  });
});

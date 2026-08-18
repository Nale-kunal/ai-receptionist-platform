import { DisabledEmailProvider } from '../providers/DisabledEmailProvider';
import { EmailService } from '../EmailService';
import { EmailServiceAdapter } from '../EmailServiceAdapter';
import type { MailQueueService } from '../queue/MailQueueService';

describe('DisabledEmailProvider & Disabled Email Flow Integration', () => {
  let provider: DisabledEmailProvider;
  let mockQueue: MailQueueService;
  let emailService: EmailService;
  let emailAdapter: EmailServiceAdapter;

  beforeEach(() => {
    provider = new DisabledEmailProvider();
    mockQueue = {
      enqueue: jest.fn().mockResolvedValue({ id: 'job_disabled_1' }),
    } as unknown as MailQueueService;
    emailService = new EmailService(mockQueue, provider);
    emailAdapter = new EmailServiceAdapter(emailService);
  });

  it('should return providerName "disabled"', () => {
    expect(provider.getProviderName()).toBe('disabled');
  });

  it('should safely execute sendEmail without crashing or logging secrets', async () => {
    const consoleSpy = jest.spyOn(console, 'info').mockImplementation(() => {});

    const result = await provider.sendEmail({
      to: 'patient@example.com',
      subject: 'Secret Invitation Token Link',
      text: 'Here is your reset token: secret_token_xyz_12345',
      html: '<a href="https://app.com/reset?token=secret_token_xyz_12345">Reset</a>',
    });

    expect(result.success).toBe(true);
    expect(result.skipped).toBe(true);
    expect(result.providerName).toBe('disabled');
    expect(result.messageId).toMatch(/^disabled_msg_/);

    // Verify safe operational log only (no tokens/body/secrets in log output)
    expect(consoleSpy).toHaveBeenCalledWith('[Email] Email delivery disabled; job skipped. [recipient=patient@example.com]');
    expect(consoleSpy).not.toHaveBeenCalledWith(expect.stringContaining('secret_token_xyz_12345'));

    consoleSpy.mockRestore();
  });

  it('should process invitation email flow without error', async () => {
    await emailAdapter.sendInvitationEmail({
      to: 'invitee@example.com',
      roleName: 'Doctor',
      tenantName: 'Bright Smile Dental',
      inviteLink: 'https://app.com/accept-invitation?token=secret_invite_token_999',
      inviterName: 'Dr. Smith',
    });

    expect(mockQueue.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        recipient: 'invitee@example.com',
        type: 'invitation',
      }),
    );
  });

  it('should process password reset flow without error', async () => {
    await emailAdapter.sendPasswordReset({
      to: 'user@example.com',
      token: 'secret_reset_token_888',
      userId: 'user-uuid-1',
    });

    expect(mockQueue.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        recipient: 'user@example.com',
        type: 'password_reset',
      }),
    );
  });

  it('should process email verification flow without error', async () => {
    await emailAdapter.sendEmailVerification({
      to: 'verify@example.com',
      token: 'secret_verify_token_777',
      userId: 'user-uuid-2',
    });

    expect(mockQueue.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        recipient: 'verify@example.com',
        type: 'email_verification',
      }),
    );
  });

  it('should process appointment notification email flows without error', async () => {
    await emailService.sendDoctorAppointmentCreatedEmail({
      to: 'doctor@example.com',
      doctorName: 'Sarah Jenkins',
      patientName: 'John Doe',
      patientPhone: '+15550199',
      appointmentDate: '2026-09-01',
      appointmentTime: '10:00 AM',
      durationMinutes: 30,
      appointmentType: 'Cleaning',
    });

    expect(mockQueue.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        recipient: 'doctor@example.com',
        type: 'notification',
      }),
    );
  });

  it('should process ownership transfer notification email flow without error', async () => {
    await emailService.sendOwnershipTransferredEmail({
      to: 'newowner@example.com',
      newOwnerName: 'Dr. Alice',
      tenantName: 'Bright Smile Dental',
    });

    expect(mockQueue.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        recipient: 'newowner@example.com',
        type: 'notification',
      }),
    );
  });
});

import type { MailQueueService } from './queue/MailQueueService';
import type { IEmailProvider } from './interfaces/IEmailProvider';
import { InvitationEmailTemplate } from './templates/InvitationEmailTemplate';
import { PasswordResetTemplate } from './templates/PasswordResetTemplate';
import { EmailVerificationTemplate } from './templates/EmailVerificationTemplate';
import { AccessRevokedEmailTemplate } from './templates/AccessRevokedEmailTemplate';
import { appConfig, formatSenderAddress } from '../../config/app-config.service';

export interface SendInvitationEmailParams {
  idempotencyKey?: string;
  to: string;
  type?: string;
  currentRoleName?: string;
  roleName: string;
  tenantName: string;
  inviterName: string;
  inviteLink: string;
  tenantId?: string;
  clinicId?: string;
}

export interface SendPasswordResetEmailParams {
  idempotencyKey?: string;
  to: string;
  resetLink: string;
  tenantId?: string;
  clinicId?: string;
}

export interface SendEmailVerificationParams {
  idempotencyKey?: string;
  to: string;
  verifyLink: string;
  tenantId?: string;
  clinicId?: string;
}

/**
 * High-Level Enterprise Email Service
 *
 * Provides typed methods for invitation, password reset, and verification emails.
 * Centralizes single source of truth sender address construction (`"NAME" <EMAIL>`).
 * Integrates with `MailQueueService` for transactional, non-blocking queueing.
 */
export class EmailService {
  constructor(
    private readonly mailQueue: MailQueueService,
    private readonly provider: IEmailProvider,
    private readonly customFromName?: string,
    private readonly customFromEmail?: string,
  ) {}

  /**
   * Return the single source of truth formatted sender address
   */
  public getSenderAddress(): string {
    if (this.customFromName && this.customFromEmail) {
      return EmailService.formatSenderAddress(this.customFromName, this.customFromEmail);
    }
    return appConfig.email.formattedFrom;
  }

  /**
   * Dynamically construct and validate a formatted sender address
   */
  public static formatSenderAddress(name: string, email: string): string {
    return formatSenderAddress(name, email);
  }

  /**
   * Enqueue an enterprise invitation email for asynchronous delivery
   */
  public async sendInvitationEmail(params: SendInvitationEmailParams): Promise<void> {
    const rendered = InvitationEmailTemplate.render({
      toEmail: params.to,
      type: params.type,
      currentRoleName: params.currentRoleName,
      roleName: params.roleName,
      tenantName: params.tenantName,
      inviterName: params.inviterName,
      inviteLink: params.inviteLink,
    });

    await this.mailQueue.enqueue({
      idempotencyKey: params.idempotencyKey,
      tenantId: params.tenantId,
      clinicId: params.clinicId,
      recipient: params.to,
      from: this.getSenderAddress(),
      type: 'invitation',
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
    });
  }

  /**
   * Enqueue a password reset email for asynchronous delivery
   */
  public async sendPasswordResetEmail(params: SendPasswordResetEmailParams): Promise<void> {
    const rendered = PasswordResetTemplate.render({
      resetLink: params.resetLink,
    });

    await this.mailQueue.enqueue({
      tenantId: params.tenantId,
      clinicId: params.clinicId,
      recipient: params.to,
      from: this.getSenderAddress(),
      type: 'password_reset',
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
    });
  }

  /**
   * Enqueue an email verification message for asynchronous delivery
   */
  public async sendEmailVerification(params: SendEmailVerificationParams): Promise<void> {
    const rendered = EmailVerificationTemplate.render({
      verifyLink: params.verifyLink,
    });

    await this.mailQueue.enqueue({
      tenantId: params.tenantId,
      clinicId: params.clinicId,
      recipient: params.to,
      from: this.getSenderAddress(),
      type: 'email_verification',
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
    });
  }

  public async sendInvitationAcceptedNotificationEmail(params: {
    to: string;
    acceptedByName: string;
    roleName: string;
    tenantName: string;
    tenantId?: string;
  }): Promise<void> {
    const subject = `${params.acceptedByName} has accepted your invitation to join ${params.tenantName}`;
    const text = `Hello,\n\n${params.acceptedByName} has accepted your invitation and joined ${params.tenantName} as ${params.roleName}.\n\nBest regards,\nDental AI Platform`;
    const html = `<div style="font-family: sans-serif; padding: 24px; background: #f8fafc;">
      <h2 style="color: #0f172a;">Invitation Accepted</h2>
      <p><strong>${params.acceptedByName}</strong> has accepted the invitation to join <strong>${params.tenantName}</strong> in the role of <strong>${params.roleName}</strong>.</p>
    </div>`;

    await this.mailQueue.enqueue({
      tenantId: params.tenantId,
      recipient: params.to,
      from: this.getSenderAddress(),
      type: 'notification',
      subject,
      html,
      text,
    });
  }

  public async sendInvitationDeclinedNotificationEmail(params: {
    to: string;
    declinedByName: string;
    roleName: string;
    tenantName: string;
    tenantId?: string;
  }): Promise<void> {
    const subject = `Invitation declined for ${params.tenantName}`;
    const text = `Hello,\n\n${params.declinedByName} has declined the invitation to join ${params.tenantName} as ${params.roleName}.\n\nBest regards,\nDental AI Platform`;
    const html = `<div style="font-family: sans-serif; padding: 24px; background: #f8fafc;">
      <h2 style="color: #0f172a;">Invitation Declined</h2>
      <p><strong>${params.declinedByName}</strong> has declined the invitation to join <strong>${params.tenantName}</strong>.</p>
    </div>`;

    await this.mailQueue.enqueue({
      tenantId: params.tenantId,
      recipient: params.to,
      from: this.getSenderAddress(),
      type: 'notification',
      subject,
      html,
      text,
    });
  }

  public async sendInvitationRevokedNotificationEmail(params: {
    to: string;
    tenantName: string;
    tenantId?: string;
  }): Promise<void> {
    const subject = `Invitation update for ${params.tenantName}`;
    const text = `Hello,\n\nYour pending invitation to join ${params.tenantName} has been revoked.\n\nBest regards,\nDental AI Platform`;
    const html = `<div style="font-family: sans-serif; padding: 24px; background: #f8fafc;">
      <h2 style="color: #0f172a;">Invitation Revoked</h2>
      <p>Your pending invitation to join <strong>${params.tenantName}</strong> has been revoked.</p>
    </div>`;

    await this.mailQueue.enqueue({
      tenantId: params.tenantId,
      recipient: params.to,
      from: this.getSenderAddress(),
      type: 'notification',
      subject,
      html,
      text,
    });
  }

  public async sendAccessRevokedEmail(params: {
    idempotencyKey?: string;
    to: string;
    recipientName?: string;
    roleName: string;
    tenantName: string;
    clinicName?: string;
    revokerName: string;
    revokedAt: Date;
    reason: string;
    tenantId?: string;
    clinicId?: string;
    timezone?: string;
  }): Promise<void> {
    const rendered = AccessRevokedEmailTemplate.render({
      toEmail: params.to,
      recipientName: params.recipientName,
      roleName: params.roleName,
      tenantName: params.clinicName || params.tenantName,
      revokerName: params.revokerName,
      revokedAt: params.revokedAt,
      reason: params.reason,
      timezone: params.timezone,
    });

    await this.mailQueue.enqueue({
      idempotencyKey: params.idempotencyKey,
      tenantId: params.tenantId,
      clinicId: params.clinicId,
      recipient: params.to,
      from: this.getSenderAddress(),
      type: 'notification',
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
    });
  }

  public async sendMembershipRemovedEmail(params: {
    to: string;
    tenantName: string;
    tenantId?: string;
    roleName?: string;
    revokerName?: string;
    reason?: string;
  }): Promise<void> {
    if (params.reason) {
      await this.sendAccessRevokedEmail({
        to: params.to,
        roleName: params.roleName || 'Staff',
        tenantName: params.tenantName,
        revokerName: params.revokerName || 'Practice Administrator',
        revokedAt: new Date(),
        reason: params.reason,
        tenantId: params.tenantId,
      });
      return;
    }
    const subject = `Practice membership update for ${params.tenantName}`;
    const text = `Hello,\n\nYour access membership to ${params.tenantName} has been removed.\n\nBest regards,\nDental AI Platform`;
    const html = `<div style="font-family: sans-serif; padding: 24px; background: #f8fafc;">
      <h2 style="color: #0f172a;">Membership Updated</h2>
      <p>Your practice membership access to <strong>${params.tenantName}</strong> has been removed.</p>
    </div>`;

    await this.mailQueue.enqueue({
      tenantId: params.tenantId,
      recipient: params.to,
      from: this.getSenderAddress(),
      type: 'notification',
      subject,
      html,
      text,
    });
  }

  public async sendOwnershipTransferredEmail(params: {
    to: string;
    newOwnerName: string;
    tenantName: string;
    tenantId?: string;
  }): Promise<void> {
    const subject = `Practice Ownership Transferred - ${params.tenantName}`;
    const text = `Hello,\n\nPractice ownership of ${params.tenantName} has been transferred to ${params.newOwnerName}.\n\nBest regards,\nDental AI Platform`;
    const html = `<div style="font-family: sans-serif; padding: 24px; background: #f8fafc;">
      <h2 style="color: #4f46e5;">Ownership Transferred</h2>
      <p>Practice ownership of <strong>${params.tenantName}</strong> has been transferred to <strong>${params.newOwnerName}</strong>.</p>
    </div>`;

    await this.mailQueue.enqueue({
      tenantId: params.tenantId,
      recipient: params.to,
      from: this.getSenderAddress(),
      type: 'notification',
      subject,
      html,
      text,
    });
  }

  public async sendDoctorAppointmentCreatedEmail(params: {
    to: string;
    doctorName: string;
    patientName: string;
    patientPhone: string;
    appointmentDate: string;
    appointmentTime: string;
    durationMinutes: number;
    appointmentType: string;
    notes?: string;
    tenantId?: string;
    clinicId?: string;
  }): Promise<void> {
    const subject = `🗓️ New Appointment Alert: ${params.patientName} on ${params.appointmentDate} at ${params.appointmentTime}`;
    const text = `Hello Dr. ${params.doctorName},\n\nA new appointment has been scheduled at your practice.\n\nPatient: ${params.patientName} (${params.patientPhone})\nDate: ${params.appointmentDate}\nTime: ${params.appointmentTime} (${params.durationMinutes} Mins)\nType: ${params.appointmentType}\n${params.notes ? `Notes: ${params.notes}\n` : ''}\nBest regards,\nDental AI Platform`;
    const html = `<div style="font-family: Arial, sans-serif; background-color: #0f172a; color: #f8fafc; padding: 24px; border-radius: 12px;">
      <div style="background-color: #1e293b; padding: 20px; border-radius: 8px; border: 1px solid #334155;">
        <h2 style="color: #6366f1; margin-top: 0;">🗓️ New Appointment Scheduled</h2>
        <p style="color: #94a3b8; font-size: 14px;">Hello <strong>Dr. ${params.doctorName}</strong>,</p>
        <p style="color: #cbd5e1; font-size: 14px;">A new patient appointment has been scheduled at your practice.</p>
        
        <div style="background-color: #0f172a; padding: 14px; border-radius: 6px; border-left: 4px solid #6366f1; margin: 16px 0; font-size: 14px;">
          <p style="margin: 4px 0;"><strong>Patient:</strong> ${params.patientName} (${params.patientPhone})</p>
          <p style="margin: 4px 0;"><strong>Date:</strong> ${params.appointmentDate}</p>
          <p style="margin: 4px 0;"><strong>Time Slot:</strong> ${params.appointmentTime} (${params.durationMinutes} Minutes)</p>
          <p style="margin: 4px 0;"><strong>Type:</strong> ${params.appointmentType}</p>
          ${params.notes ? `<p style="margin: 4px 0;"><strong>Notes:</strong> ${params.notes}</p>` : ''}
        </div>
        
        <p style="color: #64748b; font-size: 11px; margin-bottom: 0;">Dental AI Receptionist Platform • Automated Practitioner Notification</p>
      </div>
    </div>`;

    await this.mailQueue.enqueue({
      tenantId: params.tenantId,
      clinicId: params.clinicId,
      recipient: params.to,
      from: this.getSenderAddress(),
      type: 'notification',
      subject,
      html,
      text,
    });
  }

  public async sendDoctorAppointmentRescheduledEmail(params: {
    to: string;
    doctorName: string;
    patientName: string;
    patientPhone: string;
    newDate: string;
    newTime: string;
    durationMinutes: number;
    tenantId?: string;
    clinicId?: string;
  }): Promise<void> {
    const subject = `🔄 Appointment Rescheduled: ${params.patientName} moved to ${params.newDate} at ${params.newTime}`;
    const text = `Hello Dr. ${params.doctorName},\n\nAn existing appointment for ${params.patientName} has been rescheduled to ${params.newDate} at ${params.newTime} (${params.durationMinutes} Mins).\n\nBest regards,\nDental AI Platform`;
    const html = `<div style="font-family: Arial, sans-serif; background-color: #0f172a; color: #f8fafc; padding: 24px; border-radius: 12px;">
      <div style="background-color: #1e293b; padding: 20px; border-radius: 8px; border: 1px solid #334155;">
        <h2 style="color: #3b82f6; margin-top: 0;">🔄 Appointment Rescheduled</h2>
        <p style="color: #94a3b8; font-size: 14px;">Hello <strong>Dr. ${params.doctorName}</strong>,</p>
        <p style="color: #cbd5e1; font-size: 14px;">An existing patient appointment has been rescheduled to a new time slot.</p>
        
        <div style="background-color: #0f172a; padding: 14px; border-radius: 6px; border-left: 4px solid #3b82f6; margin: 16px 0; font-size: 14px;">
          <p style="margin: 4px 0;"><strong>Patient:</strong> ${params.patientName} (${params.patientPhone})</p>
          <p style="margin: 4px 0;"><strong>New Date:</strong> ${params.newDate}</p>
          <p style="margin: 4px 0;"><strong>New Time Slot:</strong> ${params.newTime} (${params.durationMinutes} Minutes)</p>
        </div>
        
        <p style="color: #64748b; font-size: 11px; margin-bottom: 0;">Dental AI Receptionist Platform • Automated Practitioner Notification</p>
      </div>
    </div>`;

    await this.mailQueue.enqueue({
      tenantId: params.tenantId,
      clinicId: params.clinicId,
      recipient: params.to,
      from: this.getSenderAddress(),
      type: 'notification',
      subject,
      html,
      text,
    });
  }

  public async sendDoctorAppointmentCancelledEmail(params: {
    to: string;
    doctorName: string;
    patientName: string;
    appointmentDate: string;
    appointmentTime: string;
    reason?: string;
    tenantId?: string;
    clinicId?: string;
  }): Promise<void> {
    const subject = `❌ Appointment Cancelled: ${params.patientName} on ${params.appointmentDate}`;
    const text = `Hello Dr. ${params.doctorName},\n\nThe appointment for ${params.patientName} on ${params.appointmentDate} at ${params.appointmentTime} has been cancelled.\n${params.reason ? `Reason: ${params.reason}\n` : ''}\nBest regards,\nDental AI Platform`;
    const html = `<div style="font-family: Arial, sans-serif; background-color: #0f172a; color: #f8fafc; padding: 24px; border-radius: 12px;">
      <div style="background-color: #1e293b; padding: 20px; border-radius: 8px; border: 1px solid #334155;">
        <h2 style="color: #ef4444; margin-top: 0;">❌ Appointment Cancelled</h2>
        <p style="color: #94a3b8; font-size: 14px;">Hello <strong>Dr. ${params.doctorName}</strong>,</p>
        <p style="color: #cbd5e1; font-size: 14px;">The following appointment has been cancelled.</p>
        
        <div style="background-color: #0f172a; padding: 14px; border-radius: 6px; border-left: 4px solid #ef4444; margin: 16px 0; font-size: 14px;">
          <p style="margin: 4px 0;"><strong>Patient:</strong> ${params.patientName}</p>
          <p style="margin: 4px 0;"><strong>Original Date:</strong> ${params.appointmentDate}</p>
          <p style="margin: 4px 0;"><strong>Original Time:</strong> ${params.appointmentTime}</p>
          ${params.reason ? `<p style="margin: 4px 0;"><strong>Reason:</strong> ${params.reason}</p>` : ''}
        </div>
        
        <p style="color: #64748b; font-size: 11px; margin-bottom: 0;">Dental AI Receptionist Platform • Automated Practitioner Notification</p>
      </div>
    </div>`;

    await this.mailQueue.enqueue({
      tenantId: params.tenantId,
      clinicId: params.clinicId,
      recipient: params.to,
      from: this.getSenderAddress(),
      type: 'notification',
      subject,
      html,
      text,
    });
  }

  public getProviderName(): string {
    return this.provider.getProviderName();
  }
}

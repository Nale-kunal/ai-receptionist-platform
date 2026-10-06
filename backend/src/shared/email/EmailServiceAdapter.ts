import type { AuthEmailProvider } from '../../modules/authentication/services/auth.service';
import type { EmailService } from './EmailService';

/**
 * Enterprise Email Service Adapter
 *
 * Adapts `EmailService` to the `AuthEmailProvider` contract consumed by
 * `AuthService` and `InvitationService`.
 */
export class EmailServiceAdapter implements AuthEmailProvider {
  constructor(private readonly emailService: EmailService) {}

  public async sendEmailVerification(params: { to: string; token: string; userId: string }): Promise<void> {
    const frontendUrl = process.env['FRONTEND_URL'] || 'http://localhost:5173';
    const verifyLink = `${frontendUrl}/verify-email?token=${params.token}`;

    await this.emailService.sendEmailVerification({
      to: params.to,
      verifyLink,
    });
  }

  public async sendPasswordReset(params: { to: string; token: string; userId: string }): Promise<void> {
    const frontendUrl = process.env['FRONTEND_URL'] || 'http://localhost:5173';
    const resetLink = `${frontendUrl}/reset-password?token=${params.token}`;

    await this.emailService.sendPasswordResetEmail({
      to: params.to,
      resetLink,
    });
  }

  public async sendInvitationEmail(params: {
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
  }): Promise<void> {
    await this.emailService.sendInvitationEmail({
      to: params.to,
      type: params.type,
      currentRoleName: params.currentRoleName,
      roleName: params.roleName,
      tenantName: params.tenantName,
      inviterName: params.inviterName,
      inviteLink: params.inviteLink,
      tenantId: params.tenantId,
      clinicId: params.clinicId,
      idempotencyKey: params.idempotencyKey,
    });
  }
}

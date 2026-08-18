import type { IEmailProvider, EmailOptions, EmailSendResult } from '../interfaces/IEmailProvider';

/**
 * Disabled Email Provider for Production Deployments
 *
 * Used when external email delivery is intentionally disabled (e.g. before acquiring a custom domain).
 * Safely accepts email jobs and completes them without contacting external services or logging sensitive payload tokens.
 */
export class DisabledEmailProvider implements IEmailProvider {
  public async sendEmail(options: EmailOptions): Promise<EmailSendResult> {
    console.info(`[Email] Email delivery disabled; job skipped. [recipient=${options.to}]`);

    const messageId = `disabled_msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    return {
      success: true,
      skipped: true,
      error: 'Email delivery disabled; job skipped.',
      messageId,
      providerName: this.getProviderName(),
    };
  }

  public getProviderName(): string {
    return 'disabled';
  }
}

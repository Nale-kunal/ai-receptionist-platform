import type { IEmailProvider, EmailOptions, EmailSendResult } from '../interfaces/IEmailProvider';

/**
 * Mock / Dev Console Email Provider
 *
 * Captures emails in memory and logs formatted previews to console.
 * Used during local development and automated testing.
 */
export class MockEmailProvider implements IEmailProvider {
  public sentEmails: EmailOptions[] = [];

  public async sendEmail(options: EmailOptions): Promise<EmailSendResult> {
    this.sentEmails.push(options);

    // Simulate failure if recipient contains 'invalid' or 'fail'
    if (options.to.includes('fail') || options.to.includes('invalid-smtp')) {
      return {
        success: false,
        error: 'Simulated email provider delivery failure',
        providerName: this.getProviderName(),
      };
    }

    const messageId = `mock_msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    if (process.env['NODE_ENV'] !== 'test') {
      console.info(`[MockEmailProvider] 📧 EMAIL SENT TO: ${options.to}`);
      console.info(`[MockEmailProvider]    Subject: ${options.subject}`);
      console.info(`[MockEmailProvider]    Message ID: ${messageId}`);
    }

    return {
      success: true,
      messageId,
      providerName: this.getProviderName(),
    };
  }

  public getProviderName(): string {
    return 'mock';
  }

  public clear(): void {
    this.sentEmails = [];
  }
}

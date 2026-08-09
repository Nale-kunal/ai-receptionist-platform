import type { IEmailProvider, EmailOptions, EmailSendResult } from '../interfaces/IEmailProvider';

/**
 * Postmark API Email Provider
 */
export class PostmarkEmailProvider implements IEmailProvider {
  private readonly serverToken: string;
  private readonly defaultFrom: string;

  constructor(serverToken?: string, defaultFrom?: string) {
    this.serverToken = serverToken || process.env['POSTMARK_SERVER_TOKEN'] || '';
    this.defaultFrom = defaultFrom || process.env['EMAIL_FROM'] || 'Dental AI <no-reply@dentalai.com>';
  }

  public async sendEmail(options: EmailOptions): Promise<EmailSendResult> {
    if (!this.serverToken) {
      return {
        success: false,
        error: 'POSTMARK_SERVER_TOKEN is not configured',
        providerName: this.getProviderName(),
      };
    }

    try {
      const response = await fetch('https://api.postmarkapp.com/email', {
        method: 'POST',
        headers: {
          'X-Postmark-Server-Token': this.serverToken,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          From: options.from || this.defaultFrom,
          To: options.to,
          Subject: options.subject,
          HtmlBody: options.html,
          TextBody: options.text,
          ReplyTo: options.replyTo,
        }),
      });

      const data = await response.json() as any;

      if (!response.ok || data?.ErrorCode !== 0) {
        return {
          success: false,
          error: data?.Message || `Postmark API HTTP ${response.status}`,
          providerName: this.getProviderName(),
        };
      }

      return {
        success: true,
        messageId: data?.MessageID || `postmark_${Date.now()}`,
        providerName: this.getProviderName(),
      };
    } catch (err: any) {
      return {
        success: false,
        error: err?.message || 'Failed to connect to Postmark API',
        providerName: this.getProviderName(),
      };
    }
  }

  public getProviderName(): string {
    return 'postmark';
  }
}

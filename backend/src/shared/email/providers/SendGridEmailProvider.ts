import type { IEmailProvider, EmailOptions, EmailSendResult } from '../interfaces/IEmailProvider';

/**
 * SendGrid v3 API Email Provider
 */
export class SendGridEmailProvider implements IEmailProvider {
  private readonly apiKey: string;
  private readonly defaultFrom: string;

  constructor(apiKey?: string, defaultFrom?: string) {
    this.apiKey = apiKey || process.env['SENDGRID_API_KEY'] || '';
    this.defaultFrom = defaultFrom || process.env['EMAIL_FROM'] || 'Dental AI <no-reply@dentalai.com>';
  }

  public async sendEmail(options: EmailOptions): Promise<EmailSendResult> {
    if (!this.apiKey) {
      return {
        success: false,
        error: 'SENDGRID_API_KEY is not configured',
        providerName: this.getProviderName(),
      };
    }

    try {
      const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          personalizations: [
            {
              to: [{ email: options.to }],
              subject: options.subject,
            },
          ],
          from: { email: options.from || this.defaultFrom },
          content: [
            { type: 'text/plain', value: options.text },
            { type: 'text/html', value: options.html },
          ],
        }),
      });

      if (!response.ok && response.status !== 202 && response.status !== 200) {
        const text = await response.text();
        return {
          success: false,
          error: text || `SendGrid API HTTP ${response.status}`,
          providerName: this.getProviderName(),
        };
      }

      const messageId = response.headers.get('x-message-id') || `sg_${Date.now()}`;

      return {
        success: true,
        messageId,
        providerName: this.getProviderName(),
      };
    } catch (err: any) {
      return {
        success: false,
        error: err?.message || 'Failed to connect to SendGrid API',
        providerName: this.getProviderName(),
      };
    }
  }

  public getProviderName(): string {
    return 'sendgrid';
  }
}

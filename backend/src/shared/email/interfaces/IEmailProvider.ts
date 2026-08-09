/**
 * Swappable Email Provider Interface
 *
 * All production email providers (SMTP, SendGrid, Resend, Postmark, AWS SES, Mock)
 * must implement this contract.
 */

export interface EmailAttachment {
  filename: string;
  content: Buffer | string;
  contentType?: string;
}

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text: string;
  from?: string;
  replyTo?: string;
  attachments?: EmailAttachment[];
  headers?: Record<string, string>;
}

export interface EmailSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
  providerName: string;
  attempts?: number;
}

export interface IEmailProvider {
  /**
   * Send a single email message
   */
  sendEmail(options: EmailOptions): Promise<EmailSendResult>;

  /**
   * Return the identifier name of this provider (e.g. 'smtp', 'resend', 'sendgrid', 'postmark', 'mock')
   */
  getProviderName(): string;
}

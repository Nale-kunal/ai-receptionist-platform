import type { IEmailProvider } from './interfaces/IEmailProvider';
import { MockEmailProvider } from './providers/MockEmailProvider';
import { SmtpEmailProvider } from './providers/SmtpEmailProvider';
import { ResendEmailProvider } from './providers/ResendEmailProvider';
import { SendGridEmailProvider } from './providers/SendGridEmailProvider';
import { PostmarkEmailProvider } from './providers/PostmarkEmailProvider';

export class EmailProviderConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EmailProviderConfigurationError';
  }
}

/**
 * Enterprise Email Provider Factory
 *
 * Dynamically resolves and constructs swappable email provider instances.
 * Business logic depends strictly on `IEmailProvider`, never directly on concrete providers.
 */
export class EmailProviderFactory {
  public static createProvider(overrideProviderName?: string): IEmailProvider {
    const providerName = (
      overrideProviderName ||
      process.env['EMAIL_PROVIDER'] ||
      (process.env['NODE_ENV'] === 'test' ? 'mock' : 'resend')
    ).toLowerCase();

    // Validate configuration in production mode
    if (process.env['NODE_ENV'] === 'production' && !overrideProviderName) {
      EmailProviderFactory.validateConfiguration(providerName);
    }

    switch (providerName) {
      case 'resend':
        return new ResendEmailProvider();

      case 'sendgrid':
        return new SendGridEmailProvider();

      case 'postmark':
        return new PostmarkEmailProvider();

      case 'smtp':
        return new SmtpEmailProvider();

      case 'mock':
      case 'test':
      case 'console':
      default:
        return new MockEmailProvider();
    }
  }

  public static validateConfiguration(providerName: string): void {
    const p = providerName.toLowerCase();
    if (p === 'resend' && !process.env['RESEND_API_KEY']) {
      throw new EmailProviderConfigurationError('RESEND_API_KEY environment variable is missing for Resend provider');
    }
    if (p === 'sendgrid' && !process.env['SENDGRID_API_KEY']) {
      throw new EmailProviderConfigurationError('SENDGRID_API_KEY environment variable is missing for SendGrid provider');
    }
    if (p === 'postmark' && !process.env['POSTMARK_SERVER_TOKEN']) {
      throw new EmailProviderConfigurationError('POSTMARK_SERVER_TOKEN environment variable is missing for Postmark provider');
    }
    if (p === 'smtp' && !process.env['SMTP_HOST']) {
      throw new EmailProviderConfigurationError('SMTP_HOST environment variable is missing for SMTP provider');
    }
  }
}

import type { IEmailProvider, EmailOptions, EmailSendResult } from '../interfaces/IEmailProvider';
import { appConfig } from '../../../config/app-config.service';

/**
 * Resend.com API Email Provider
 *
 * Implements Resend.com REST API v1 email transport with Bearer token authentication,
 * deliverability headers, attachments, and provider message ID tracking.
 */
export class ResendEmailProvider implements IEmailProvider {
  private readonly apiKey: string;
  private readonly defaultFrom: string;

  constructor(apiKey?: string, defaultFrom?: string) {
    this.apiKey = apiKey !== undefined ? apiKey : (appConfig.email.resendApiKey || process.env['RESEND_API_KEY'] || '');
    this.defaultFrom = defaultFrom || appConfig.email.formattedFrom;
  }

  public async sendEmail(options: EmailOptions): Promise<EmailSendResult> {
    if (!this.apiKey) {
      return {
        success: false,
        error: 'RESEND_API_KEY is not configured',
        providerName: this.getProviderName(),
      };
    }

    // In automated test mode or for synthetic test domains (@example.com, @test.com),
    // suppress live external HTTP email dispatch unless explicitly requested via ENABLE_LIVE_EMAIL_TESTS=true
    const isSyntheticDomain = options.to.endsWith('@example.com') || options.to.endsWith('@test.com');
    const isTestMode = process.env['NODE_ENV'] === 'test';
    if ((isTestMode || isSyntheticDomain) && process.env['ENABLE_LIVE_EMAIL_TESTS'] !== 'true') {
      console.info(`[ResendEmailProvider] 🧪 Test Guard: Suppressing live Resend API call for '${options.to}'`);
      return {
        success: true,
        messageId: `test_suppressed_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
        providerName: this.getProviderName(),
      };
    }

    try {
      let targetRecipient = options.to;
      const fromAddress = options.from || this.defaultFrom;
      const devOverride = process.env['RESEND_TEST_RECIPIENT_OVERRIDE'];

      if (devOverride && devOverride.trim() && targetRecipient !== devOverride && process.env['NODE_ENV'] === 'development') {
        console.info(`[ResendEmailProvider] Dev Mode Override: Routing outbound mail from '${targetRecipient}' -> '${devOverride}'`);
        targetRecipient = devOverride;
      }

      const payload: Record<string, any> = {
        from: fromAddress,
        to: [targetRecipient],
        subject: options.subject,
        html: options.html,
        text: options.text,
        reply_to: options.replyTo,
        headers: {
          'Auto-Submitted': 'auto-generated',
          'X-Auto-Response-Suppress': 'All',
          ...options.headers,
        },
      };

      if (options.attachments && options.attachments.length > 0) {
        payload['attachments'] = options.attachments.map((att) => ({
          filename: att.filename,
          content: Buffer.isBuffer(att.content) ? att.content.toString('base64') : att.content,
        }));
      }

      console.info(`[ResendEmailProvider] 📤 Executing HTTP POST https://api.resend.com/emails:`, {
        from: payload.from,
        to: payload.to,
        originalRecipient: options.to,
        subject: payload.subject,
      });

      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = (await response.json()) as any;

      if (!response.ok) {
        console.error(`[ResendEmailProvider] ❌ Resend API HTTP ${response.status} Error:`, data);
        return {
          success: false,
          error: data?.message || `Resend API HTTP ${response.status}`,
          providerName: this.getProviderName(),
        };
      }

      console.info(`[ResendEmailProvider] ✅ Email delivered successfully via Resend API (HTTP ${response.status})! Message ID: ${data?.id}`);

      return {
        success: true,
        messageId: data?.id || `resend_${Date.now()}`,
        providerName: this.getProviderName(),
      };
    } catch (err: any) {
      console.error(`[ResendEmailProvider] ❌ Network/Execution Error:`, err);
      return {
        success: false,
        error: err?.message || 'Failed to connect to Resend API',
        providerName: this.getProviderName(),
      };
    }
  }

  public getProviderName(): string {
    return 'resend';
  }
}

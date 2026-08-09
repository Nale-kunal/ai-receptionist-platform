/**
 * MetaCloudWhatsAppProvider
 *
 * Production implementation of IWhatsAppProvider using Meta WhatsApp Cloud API.
 *
 * Security:
 *  - Webhook signature verified via HMAC-SHA256 with timingSafeEqual (no timing oracle)
 *  - Raw body required before any JSON parsing (Express raw body parser on webhook route)
 *  - Access token is NEVER logged or exposed in error messages
 *  - No SDK dependency — uses built-in fetch (same pattern as OpenAiProvider)
 *
 * API Reference: https://developers.facebook.com/docs/whatsapp/cloud-api
 */

import * as crypto from 'crypto';
import type { IWhatsAppProvider } from './whatsapp-provider.interface';
import type { ProviderSendResult } from '../interfaces/whatsapp.interfaces';
import { META_GRAPH_API_BASE } from '../constants/whatsapp.constants';

export interface MetaCloudProviderConfig {
  appSecret: string;
  accessToken: string;
  apiVersion: string;   // e.g. 'v21.0'
}

export class MetaCloudWhatsAppProvider implements IWhatsAppProvider {
  private readonly apiVersion: string;
  private readonly accessToken: string;
  private readonly appSecretBuffer: Buffer;

  constructor(private readonly config: MetaCloudProviderConfig) {
    this.apiVersion   = config.apiVersion || 'v21.0';
    this.accessToken  = config.accessToken;
    this.appSecretBuffer = Buffer.from(config.appSecret, 'utf8');
  }

  /**
   * Verify X-Hub-Signature-256 header using HMAC-SHA256 of raw body.
   *
   * Signature format: "sha256=<hex_digest>"
   * Uses crypto.timingSafeEqual to prevent timing-based side-channel attacks.
   */
  public verifyWebhookSignature(rawBody: Buffer, sigHeader: string): boolean {
    if (!sigHeader || !sigHeader.startsWith('sha256=')) {
      return false;
    }

    const receivedHex = sigHeader.slice('sha256='.length);

    let receivedBytes: Buffer;
    try {
      receivedBytes = Buffer.from(receivedHex, 'hex');
    } catch {
      return false;
    }

    const expectedHex = crypto
      .createHmac('sha256', this.appSecretBuffer)
      .update(rawBody)
      .digest('hex');

    const expectedBytes = Buffer.from(expectedHex, 'hex');

    // Ensure same length before timingSafeEqual (different lengths still return false)
    if (receivedBytes.length !== expectedBytes.length) {
      return false;
    }

    return crypto.timingSafeEqual(receivedBytes, expectedBytes);
  }

  /**
   * Send a plain text message via Meta Cloud API.
   */
  public async sendTextMessage(
    phoneNumberId: string,
    to: string,
    text: string,
    correlationId?: string,
  ): Promise<ProviderSendResult> {
    const url = `${META_GRAPH_API_BASE}/${this.apiVersion}/${phoneNumberId}/messages`;

    const body = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'text',
      text: { body: text.slice(0, 4096) }, // Meta limit: 4096 chars
    };

    return this.postWithRetry(url, body, correlationId);
  }

  /**
   * Send a pre-approved template message.
   * Required when messaging outside the 24-hour customer service window.
   */
  public async sendTemplateMessage(
    phoneNumberId: string,
    to: string,
    templateName: string,
    languageCode: string,
    params?: string[],
  ): Promise<ProviderSendResult> {
    const url = `${META_GRAPH_API_BASE}/${this.apiVersion}/${phoneNumberId}/messages`;

    const components = params && params.length > 0
      ? [{
          type: 'body',
          parameters: params.map((p) => ({ type: 'text', text: p })),
        }]
      : [];

    const body = {
      messaging_product: 'whatsapp',
      to,
      type: 'template',
      template: {
        name: templateName,
        language: { code: languageCode },
        components,
      },
    };

    return this.postWithRetry(url, body);
  }

  /**
   * Mark a received message as read (optional, improves UX).
   */
  public async markMessageRead(phoneNumberId: string, wamid: string): Promise<void> {
    const url = `${META_GRAPH_API_BASE}/${this.apiVersion}/${phoneNumberId}/messages`;
    const body = {
      messaging_product: 'whatsapp',
      status: 'read',
      message_id: wamid,
    };

    try {
      await this.metaPost(url, body);
    } catch {
      // Mark-read failures are non-fatal
    }
  }

  // ---------------------------------------------------------------------------
  // Private Helpers
  // ---------------------------------------------------------------------------

  private async postWithRetry(
    url: string,
    body: Record<string, unknown>,
    correlationId?: string,
    maxRetries = 2,
  ): Promise<ProviderSendResult> {
    let lastError: string = '';

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const data = await this.metaPost(url, body);
        const wamid = (data as any)?.messages?.[0]?.id as string | undefined;
        return { success: true, providerMessageId: wamid };
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);

        // Do not retry on auth or permanent errors
        if (lastError.includes('401') || lastError.includes('400')) {
          break;
        }

        if (attempt < maxRetries) {
          const backoffMs = Math.pow(2, attempt) * 1000;
          await new Promise((r) => setTimeout(r, backoffMs));
        }
      }
    }

    // Log correlation without exposing token
    console.error(`[WhatsApp] Send failed${correlationId ? ` [${correlationId}]` : ''}: ${lastError}`);
    return { success: false, error: lastError };
  }

  private async metaPost(url: string, body: Record<string, unknown>): Promise<unknown> {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`Meta API ${response.status}: ${text.slice(0, 200)}`);
    }

    return response.json();
  }
}

/**
 * No-op provider for development/test without Meta credentials.
 * Logs outbound messages to console; always returns success.
 * Never used in production (env validator guards access token presence).
 */
export class DevNoOpWhatsAppProvider implements IWhatsAppProvider {
  public verifyWebhookSignature(_rawBody: Buffer, _sigHeader: string): boolean {
    // In development, skip signature verification if no app secret configured
    return true;
  }

  public async sendTextMessage(
    phoneNumberId: string,
    to: string,
    text: string,
    correlationId?: string,
  ): Promise<ProviderSendResult> {
    console.log(`[WhatsApp DEV] sendTextMessage → ${to} [pnId=${phoneNumberId}] [corr=${correlationId}]: ${text.slice(0, 80)}...`);
    return { success: true, providerMessageId: `dev_${Date.now()}` };
  }

  public async sendTemplateMessage(
    phoneNumberId: string,
    to: string,
    templateName: string,
    languageCode: string,
  ): Promise<ProviderSendResult> {
    console.log(`[WhatsApp DEV] sendTemplateMessage → ${to} template=${templateName} lang=${languageCode}`);
    return { success: true, providerMessageId: `dev_tpl_${Date.now()}` };
  }

  public async markMessageRead(_phoneNumberId: string, wamid: string): Promise<void> {
    console.log(`[WhatsApp DEV] markMessageRead wamid=${wamid}`);
  }
}

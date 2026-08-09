/**
 * IWhatsAppProvider — Provider Abstraction Interface
 *
 * Decouples the WhatsApp module from any specific messaging vendor.
 * The MetaCloudWhatsAppProvider is the production implementation.
 */

import type { ProviderSendResult } from '../interfaces/whatsapp.interfaces';

export interface IWhatsAppProvider {
  /**
   * Verify the X-Hub-Signature-256 header from a Meta webhook POST.
   *
   * Uses HMAC-SHA256 of the raw request body with the app secret.
   * MUST use crypto.timingSafeEqual to prevent timing attacks.
   *
   * @param rawBody    Raw Buffer of the request body (before JSON parse)
   * @param sigHeader  Value of X-Hub-Signature-256 header, e.g. "sha256=abc123"
   * @returns          true if valid, false otherwise
   */
  verifyWebhookSignature(rawBody: Buffer, sigHeader: string): boolean;

  /**
   * Send a plain text message to a WhatsApp contact.
   *
   * @param phoneNumberId  Meta phone number ID (from WhatsAppIntegration)
   * @param to             E.164 recipient phone number
   * @param text           Message text (max 4096 chars per Meta limits)
   * @param correlationId  Correlation ID for tracing
   */
  sendTextMessage(
    phoneNumberId: string,
    to: string,
    text: string,
    correlationId?: string,
  ): Promise<ProviderSendResult>;

  /**
   * Send a template message (required when outside the 24-hour service window).
   *
   * @param phoneNumberId  Meta phone number ID
   * @param to             E.164 recipient
   * @param templateName   Approved Meta template name
   * @param languageCode   e.g. 'en_US'
   * @param params         Template parameter values (positional)
   */
  sendTemplateMessage(
    phoneNumberId: string,
    to: string,
    templateName: string,
    languageCode: string,
    params?: string[],
  ): Promise<ProviderSendResult>;

  /**
   * Mark a received message as read (sends read receipt to sender).
   *
   * @param phoneNumberId Meta phone number ID
   * @param wamid         Meta message ID to mark as read
   */
  markMessageRead(phoneNumberId: string, wamid: string): Promise<void>;
}

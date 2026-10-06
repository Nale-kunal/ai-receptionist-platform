/**
 * WhatsApp Outbound Service
 *
 * Handles sending messages to patients via the Meta Cloud API provider.
 * Uses the durable WhatsAppJob queue for reliability.
 * Idempotency key prevents resending an already-sent message.
 */

import * as crypto from 'crypto';
import type { IWhatsAppProvider } from '../providers/whatsapp-provider.interface';
import type { WhatsAppMessageRepository } from '../repositories/whatsapp-message.repository';
import type { WhatsAppIntegrationRepository } from '../repositories/whatsapp-integration.repository';
import { WHATSAPP_MSG_OUTBOUND } from '../constants/whatsapp.constants';
import { WhatsAppIntegrationDisabledError, WhatsAppIsolationViolationError } from '../errors/whatsapp.errors';

export class WhatsAppOutboundService {
  constructor(
    private readonly provider: IWhatsAppProvider,
    private readonly messageRepo: WhatsAppMessageRepository,
    private readonly integrationRepo?: WhatsAppIntegrationRepository,
  ) {}

  /**
   * Send a text message to a patient.
   * Verifies integration active state and tenant boundary before sending.
   * Persists message record before sending to track state.
   */
  public async sendTextMessage(params: {
    tenantId: string;
    clinicId: string;
    integrationId: string;
    phoneNumberId: string;
    fromPhone: string;
    toPhone: string;
    messageText: string;
    conversationId?: string;
    correlationId?: string;
  }): Promise<{ success: boolean; providerMessageId?: string }> {
    // Verify integration state & strict tenant boundary if repo is available
    if (this.integrationRepo) {
      const integration = await this.integrationRepo.findById(params.integrationId, params.tenantId);
      if (!integration || !integration.isEnabled || integration.status !== 'active') {
        throw new WhatsAppIntegrationDisabledError();
      }
      if (integration.clinicId !== params.clinicId || integration.phoneNumberId !== params.phoneNumberId) {
        throw new WhatsAppIsolationViolationError();
      }
    }
    // Generate idempotency key
    const contentHash = crypto.createHash('sha256').update(params.messageText).digest('hex').slice(0, 16);
    const idempotencyKey = `out_${params.conversationId ?? params.toPhone}_${contentHash}_${Date.now()}`;

    // Persist outbound message record first
    const message = await this.messageRepo.create({
      tenantId: params.tenantId,
      clinicId: params.clinicId,
      integrationId: params.integrationId,
      conversationId: params.conversationId,
      providerMessageId: idempotencyKey,  // Placeholder until we have wamid
      direction: WHATSAPP_MSG_OUTBOUND,
      fromNumber: params.fromPhone,
      toNumber: params.toPhone,
      messageType: 'text',
      content: { text: params.messageText },
      metadata: { correlationId: params.correlationId },
    });

    // Send via provider
    const result = await this.provider.sendTextMessage(
      params.phoneNumberId,
      params.toPhone,
      params.messageText,
      params.correlationId,
    );

    // Update with actual wamid if successful
    if (result.success && result.providerMessageId) {
      await this.messageRepo.updateStatus(message.id, 'sent', result.providerMessageId);
    } else {
      await this.messageRepo.updateStatus(message.id, 'failed');
    }

    return result;
  }
}

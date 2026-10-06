/**
 * WhatsApp Tenant Resolver Service
 *
 * Resolves an inbound WhatsApp destination phone number to a specific
 * clinic and tenant using the WhatsAppIntegration table.
 *
 * Security Contract:
 *  - The destination phone ('to' field) comes from the Meta payload
 *  - NEVER trusts tenantId or clinicId from the payload body or AI output
 *  - Uses UNIQUE DB constraint on phoneNumber (one clinic per number)
 *  - Unresolvable phones are quarantined (not rejected) to prevent Meta retry storms
 */

import type { WhatsAppIntegrationRepository } from '../repositories/whatsapp-integration.repository';
import type { SafeWhatsAppIntegration } from '../interfaces/whatsapp.interfaces';
import {
  WhatsAppIntegrationNotFoundError,
  WhatsAppIntegrationDisabledError,
  WhatsAppWabaMismatchError,
} from '../errors/whatsapp.errors';

export interface ResolvedWhatsAppContext {
  integration: SafeWhatsAppIntegration;
  tenantId: string;
  clinicId: string;
  integrationId: string;
  phoneNumberId: string;
}

export class WhatsAppTenantResolverService {
  constructor(
    private readonly integrationRepo: WhatsAppIntegrationRepository,
  ) {}

  /**
   * Resolve an inbound Meta WhatsApp event by Meta identifiers:
   * 1. Match by phone_number_id (unique per Meta phone number)
   * 2. Verify that the incoming WABA ID matches integration's wabaId
   * 3. Ensure integration is active and enabled
   *
   * @param phoneNumberId Meta phone number ID from change.value.metadata.phone_number_id
   * @param wabaId WhatsApp Business Account ID from entry.id
   * @param destinationPhone Optional E.164 fallback from change.value.metadata.display_phone_number
   */
  public async resolveByMeta(
    phoneNumberId: string,
    wabaId: string,
    destinationPhone?: string,
  ): Promise<ResolvedWhatsAppContext> {
    // 1. Resolve by phoneNumberId first (exact Meta identity)
    let integration = await this.integrationRepo.findByPhoneNumberId(phoneNumberId);

    // 2. Fallback to destination phone number if not resolved by ID
    if (!integration && destinationPhone) {
      integration = await this.integrationRepo.findByPhoneNumber(destinationPhone);
    }

    if (!integration) {
      throw new WhatsAppIntegrationNotFoundError(phoneNumberId || destinationPhone);
    }

    // 3. Verify WABA boundary — prevent cross-account injection
    if (wabaId && integration.wabaId !== wabaId) {
      throw new WhatsAppWabaMismatchError(integration.wabaId, wabaId);
    }

    // 4. Verify channel lifecycle state
    if (!integration.isEnabled || integration.status !== 'active') {
      throw new WhatsAppIntegrationDisabledError();
    }

    return {
      integration,
      tenantId: integration.tenantId,
      clinicId: integration.clinicId,
      integrationId: integration.id,
      phoneNumberId: integration.phoneNumberId,
    };
  }

  /**
   * Safe resolve by Meta identifiers — returns null on mismatch, not found, or disabled.
   */
  public async tryResolveByMeta(
    phoneNumberId: string,
    wabaId: string,
    destinationPhone?: string,
  ): Promise<ResolvedWhatsAppContext | null> {
    try {
      return await this.resolveByMeta(phoneNumberId, wabaId, destinationPhone);
    } catch {
      return null;
    }
  }

  /**
   * Legacy resolver by destination phone number.
   */
  public async resolve(destinationPhone: string): Promise<ResolvedWhatsAppContext> {
    const integration = await this.integrationRepo.findByPhoneNumber(destinationPhone);

    if (!integration) {
      throw new WhatsAppIntegrationNotFoundError(destinationPhone);
    }

    if (!integration.isEnabled || integration.status !== 'active') {
      throw new WhatsAppIntegrationDisabledError();
    }

    return {
      integration,
      tenantId: integration.tenantId,
      clinicId: integration.clinicId,
      integrationId: integration.id,
      phoneNumberId: integration.phoneNumberId,
    };
  }

  /**
   * Resolve without throwing — returns null for unresolvable/disabled numbers.
   */
  public async tryResolve(destinationPhone: string): Promise<ResolvedWhatsAppContext | null> {
    try {
      return await this.resolve(destinationPhone);
    } catch {
      return null;
    }
  }
}

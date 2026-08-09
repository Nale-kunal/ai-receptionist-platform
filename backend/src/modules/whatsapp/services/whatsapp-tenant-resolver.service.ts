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
import { WhatsAppIntegrationNotFoundError, WhatsAppIntegrationDisabledError } from '../errors/whatsapp.errors';

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
   * Resolve a destination phone number to a clinic/tenant context.
   *
   * @param destinationPhone E.164 phone number from Meta payload 'to' field
   * @throws WhatsAppIntegrationNotFoundError if no integration matches
   * @throws WhatsAppIntegrationDisabledError if integration is inactive
   */
  public async resolve(destinationPhone: string): Promise<ResolvedWhatsAppContext> {
    // Always query the DB — no caching of integration status
    // (enables real-time enable/disable without server restart)
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
   * Used in webhook handler to quarantine rather than crash.
   */
  public async tryResolve(destinationPhone: string): Promise<ResolvedWhatsAppContext | null> {
    try {
      return await this.resolve(destinationPhone);
    } catch {
      return null;
    }
  }
}

/**
 * WhatsApp Event Definitions
 */

export const EVENT_WHATSAPP_MESSAGE_RECEIVED = 'whatsapp.message.received' as const;
export const EVENT_WHATSAPP_MESSAGE_SENT     = 'whatsapp.message.sent' as const;
export const EVENT_WHATSAPP_HANDOFF_REQUESTED = 'whatsapp.handoff.requested' as const;

export interface WhatsAppMessageReceivedPayload {
  tenantId: string;
  clinicId: string;
  integrationId: string;
  conversationId?: string;
  messageId: string;
  fromPhone: string;
  messageType: string;
  correlationId: string;
}

export interface WhatsAppMessageSentPayload {
  tenantId: string;
  clinicId: string;
  integrationId: string;
  conversationId?: string;
  messageId: string;
  toPhone: string;
  correlationId: string;
}

export interface WhatsAppHandoffRequestedPayload {
  tenantId: string;
  clinicId: string;
  integrationId: string;
  conversationId: string;
  patientPhone: string;
  reason: string;
  correlationId: string;
}

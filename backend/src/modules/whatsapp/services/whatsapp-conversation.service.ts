/**
 * WhatsApp Conversation Service
 *
 * Manages WhatsApp conversation sessions using the existing ConversationService
 * for persistence. Stores WhatsApp-specific state in Conversation.metadata.
 *
 * Security Contract:
 *  - All state writes validated before persisting
 *  - LLM output NEVER directly written to DB
 *  - patientPhone is immutable for the session lifetime
 *  - Turn count and rate limit enforced here, not in AI orchestrator
 */

import type { ConversationService } from '../../conversation/services/conversation.service';
import type { WhatsAppConversationContext } from '../interfaces/whatsapp.interfaces';
import {
  WHATSAPP_INTENT_UNKNOWN,
  CONVERSATION_CHANNEL_WHATSAPP,
  WHATSAPP_SESSION_WINDOW_MINUTES,
  WHATSAPP_MAX_TURNS_PER_SESSION,
  WHATSAPP_RATE_LIMIT_WINDOW_MS,
  WHATSAPP_RATE_LIMIT_MAX_MESSAGES,
} from '../constants/whatsapp.constants';
import { WhatsAppMaxTurnsExceededError, WhatsAppRateLimitError } from '../errors/whatsapp.errors';
import type { WhatsAppIntent } from '../constants/whatsapp.constants';

export class WhatsAppConversationService {
  constructor(
    private readonly conversationService: ConversationService,
  ) {}

  /**
   * Find an active WhatsApp conversation for this patient+clinic within the session window,
   * or create a new one.
   */
  public async getOrCreateConversation(
    tenantId: string,
    clinicId: string,
    patientPhone: string,
    integrationId: string,
    correlationId: string,
  ): Promise<{ conversationId: string; context: WhatsAppConversationContext; isNew: boolean }> {
    const windowStart = new Date(Date.now() - WHATSAPP_SESSION_WINDOW_MINUTES * 60 * 1000);

    // Look for existing active conversation within session window
    const existing = await this.findExistingConversation(tenantId, clinicId, patientPhone, windowStart);

    if (existing) {
      const context = this.extractContext(existing);
      return { conversationId: existing.id, context, isNew: false };
    }

    // Create new conversation
    const conv = await this.conversationService.createConversation({
      tenantId,
      clinicId,
      callSessionId: `wa_${correlationId}`,
      callerPhone: patientPhone,
      startedAt: new Date(),
      source: 'whatsapp',
      metadata: {
        channel: CONVERSATION_CHANNEL_WHATSAPP,
        integrationId,
        whatsapp: this.createInitialContext(patientPhone),
      },
      actorId: 'system',
      requestId: correlationId,
    });

    const context = this.createInitialContext(patientPhone);
    return { conversationId: conv.id, context, isNew: true };
  }

  /**
   * Read current context from conversation metadata.
   */
  public async getContext(conversationId: string, tenantId: string): Promise<WhatsAppConversationContext | null> {
    const conv = await this.conversationService.getConversationById(conversationId, tenantId);
    if (!conv) return null;
    return this.extractContext(conv);
  }

  /**
   * Update the conversation context (validated updates only).
   * LLM-provided values are validated before passing here.
   */
  public async updateContext(
    conversationId: string,
    tenantId: string,
    updates: Partial<WhatsAppConversationContext>,
    correlationId: string,
  ): Promise<WhatsAppConversationContext> {
    const conv = await this.conversationService.getConversationById(conversationId, tenantId);
    if (!conv) throw new Error('Conversation not found');

    const current = this.extractContext(conv);
    const updated: WhatsAppConversationContext = { ...current, ...updates };

    await this.conversationService.updateConversation({
      id: conversationId,
      tenantId,
      metadata: {
        ...(conv.metadata as Record<string, unknown> ?? {}),
        whatsapp: updated,
      },
      actorId: 'system',
      requestId: correlationId,
    });

    return updated;
  }

  /**
   * Increment turn count and enforce limits.
   * @throws WhatsAppMaxTurnsExceededError if too many turns
   * @throws WhatsAppRateLimitError if rate limit exceeded
   */
  public async incrementTurnAndCheck(
    conversationId: string,
    tenantId: string,
    correlationId: string,
  ): Promise<WhatsAppConversationContext> {
    const context = await this.getContext(conversationId, tenantId);
    if (!context) throw new Error('Context not found');

    // Rate limiting
    const now = Date.now();
    const windowStart = context.rateLimitWindowStart ? new Date(context.rateLimitWindowStart).getTime() : now;
    const inWindow = (now - windowStart) < WHATSAPP_RATE_LIMIT_WINDOW_MS;
    const messagesInWindow = inWindow ? (context.messagesInWindow ?? 0) : 0;

    if (inWindow && messagesInWindow >= WHATSAPP_RATE_LIMIT_MAX_MESSAGES) {
      throw new WhatsAppRateLimitError();
    }

    const newTurnCount = context.turnCount + 1;

    if (newTurnCount > WHATSAPP_MAX_TURNS_PER_SESSION) {
      throw new WhatsAppMaxTurnsExceededError();
    }

    return this.updateContext(conversationId, tenantId, {
      turnCount: newTurnCount,
      lastMessageAt: new Date().toISOString(),
      rateLimitWindowStart: inWindow ? context.rateLimitWindowStart : new Date().toISOString(),
      messagesInWindow: messagesInWindow + 1,
    }, correlationId);
  }

  /**
   * Record a successful booking against the conversation.
   */
  public async recordBooking(
    conversationId: string,
    tenantId: string,
    appointmentId: string,
    correlationId: string,
  ): Promise<void> {
    const context = await this.getContext(conversationId, tenantId);
    if (!context) return;

    await this.updateContext(conversationId, tenantId, {
      confirmationPending: false,
      currentOperation: null,
      intent: null,
      appointmentType: undefined,
      doctorId: undefined,
      doctorName: undefined,
      date: undefined,
      time: undefined,
      selectedSlot: undefined,
      durationMinutes: undefined,
    }, correlationId);

    await this.conversationService.updateConversation({
      id: conversationId,
      tenantId,
      appointmentId,
      actorId: 'system',
      requestId: correlationId,
    });
  }

  /**
   * Mark conversation as escalated to human.
   */
  public async escalateToHuman(
    conversationId: string,
    tenantId: string,
    reason: string,
    correlationId: string,
  ): Promise<void> {
    await this.updateContext(conversationId, tenantId, {
      handoffActive: true,
      handoffReason: reason,
      handoffRequestedAt: new Date().toISOString(),
      confirmationPending: false,
      currentOperation: null,
    }, correlationId);
  }

  // ---------------------------------------------------------------------------
  // Private Helpers
  // ---------------------------------------------------------------------------

  private async findExistingConversation(
    tenantId: string,
    clinicId: string,
    patientPhone: string,
    windowStart: Date,
  ): Promise<any | null> {
    // Use existing conversation service list with filter
    // TODO(long-term): add callerPhone filter to ConversationService.listConversations so this
    // query is pushed to the DB layer instead of in-memory filtering. The 100-record fetch below
    // is a mitigation for busy clinics until that DB-side filter is implemented.
    const conversations = await this.conversationService.listConversations({
      tenantId,
      clinicId,
      limit: 100,
      offset: 0,
    });

    // Filter to whatsapp channel conversations with this phone within the window
    const matching = (conversations ?? []).filter((c: any) => {
      const meta = c.metadata as Record<string, unknown> | null;
      const isWhatsApp = meta?.['channel'] === CONVERSATION_CHANNEL_WHATSAPP;
      const samePhone = c.callerPhone === patientPhone;
      const inWindow = new Date(c.startedAt ?? c.createdAt) >= windowStart;
      const isActive = !['completed', 'abandoned', 'failed', 'archived'].includes(c.status);
      return isWhatsApp && samePhone && inWindow && isActive;
    });

    return matching.length > 0 ? matching[0] : null;
  }

  private extractContext(conv: any): WhatsAppConversationContext {
    const meta = conv.metadata as Record<string, unknown> | null;
    const wa = meta?.['whatsapp'] as Partial<WhatsAppConversationContext> | undefined;

    if (wa && wa.patientPhone) {
      return wa as WhatsAppConversationContext;
    }

    return this.createInitialContext(conv.callerPhone ?? '');
  }

  private createInitialContext(patientPhone: string): WhatsAppConversationContext {
    return {
      intent: null,
      patientPhone,
      confirmationPending: false,
      currentOperation: null,
      handoffActive: false,
      lastMessageAt: new Date().toISOString(),
      turnCount: 0,
    };
  }
}

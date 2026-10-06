/**
 * WhatsApp Job Service — Durable Processing Worker
 *
 * Implements the same crash-safe DB-backed polling pattern as MailQueueService:
 *  1. Poll for queued jobs (FOR UPDATE SKIP LOCKED)
 *  2. Atomically claim with lease (workerId + leaseId + leaseExpiresAt)
 *  3. Process: run AI pipeline, send reply
 *  4. Mark processed or schedule retry
 *  5. On startup: reclaim expired leases from crashed workers
 *
 * No in-memory queue. Survives process restarts.
 */

import * as crypto from 'crypto';
import type { WhatsAppJobRepository } from '../repositories/whatsapp-job.repository';
import type { WhatsAppMessageRepository } from '../repositories/whatsapp-message.repository';
import type { WhatsAppAiOrchestratorService } from './whatsapp-ai-orchestrator.service';
import type { WhatsAppConversationService } from './whatsapp-conversation.service';
import type { WhatsAppTenantResolverService } from './whatsapp-tenant-resolver.service';
import type { WhatsAppOutboundService } from './whatsapp-outbound.service';
import type { WhatsAppIntegrationRepository } from '../repositories/whatsapp-integration.repository';
import type { WhatsAppBookingService } from './whatsapp-booking.service';
import type { WhatsAppInboundJobPayload } from '../interfaces/whatsapp.interfaces';
import {
  WHATSAPP_JOB_PROCESS_INBOUND,
  WHATSAPP_JOB_SEND_OUTBOUND,
  WHATSAPP_WORKER_POLL_ACTIVE_MS,
  WHATSAPP_WORKER_POLL_IDLE_MS,
} from '../constants/whatsapp.constants';

import { isDbConnectivityError } from '../../../shared/email/queue/MailQueueService';

export class WhatsAppJobService {
  private readonly workerId = `wa_worker_${crypto.randomUUID().slice(0, 8)}`;
  private running = false;
  private pollTimer: NodeJS.Timeout | null = null;
  private isDbUnavailable = false;
  private consecutiveDbFailures = 0;

  constructor(
    private readonly jobRepo: WhatsAppJobRepository,
    private readonly messageRepo: WhatsAppMessageRepository,
    private readonly integrationRepo: WhatsAppIntegrationRepository,
    private readonly tenantResolver: WhatsAppTenantResolverService,
    private readonly orchestrator: WhatsAppAiOrchestratorService,
    private readonly conversationService: WhatsAppConversationService,
    private readonly outboundService: WhatsAppOutboundService,
    private readonly bookingService: WhatsAppBookingService,
  ) {}

  /**
   * Start the worker. Called during bootstrap after DB is ready.
   * Performs stale lease recovery before starting the poll loop.
   */
  public async initialize(): Promise<void> {
    try {
      const reclaimed = await this.jobRepo.reclaimExpiredLeases();
      if (reclaimed > 0) {
        console.log(`[WhatsApp Worker] Reclaimed ${reclaimed} expired lease(s) on startup.`);
      }
    } catch (err) {
      if (isDbConnectivityError(err)) {
        console.warn('[WhatsApp Worker] Stale lease recovery deferred (database reconnecting).');
      } else {
        console.warn('[WhatsApp Worker] Stale lease recovery error on startup:', err);
      }
    }
    this.running = true;
    this.schedulePoll(WHATSAPP_WORKER_POLL_IDLE_MS);
    console.log(`[WhatsApp Worker] Started with workerId=${this.workerId}`);
  }

  /**
   * Stop the worker gracefully. Called during server shutdown.
   */
  public shutdown(): void {
    this.running = false;
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }
    console.log('[WhatsApp Worker] Shutdown.');
  }

  // ---------------------------------------------------------------------------
  // Private: Poll Loop
  // ---------------------------------------------------------------------------

  private schedulePoll(delayMs: number): void {
    if (!this.running) return;
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }
    this.pollTimer = setTimeout(() => void this.poll(), delayMs);
    if (typeof this.pollTimer.unref === 'function') {
      this.pollTimer.unref();
    }
  }

  private async poll(): Promise<void> {
    if (!this.running) return;

    let hadJob = false;
    let nextDelayMs = WHATSAPP_WORKER_POLL_IDLE_MS;

    try {
      const job = await this.jobRepo.claimNextJob(this.workerId);

      if (job) {
        hadJob = true;
        await this.processJob(job);
      }

      if (this.isDbUnavailable) {
        this.isDbUnavailable = false;
        this.consecutiveDbFailures = 0;
        console.info('[WhatsApp Worker] Database connection restored. Resuming normal polling.');
      }
      nextDelayMs = hadJob ? WHATSAPP_WORKER_POLL_ACTIVE_MS : WHATSAPP_WORKER_POLL_IDLE_MS;
    } catch (err) {
      if (isDbConnectivityError(err)) {
        this.consecutiveDbFailures++;
        nextDelayMs = Math.min(2000 * Math.pow(2, Math.min(this.consecutiveDbFailures - 1, 5)), 60000);
        if (!this.isDbUnavailable) {
          this.isDbUnavailable = true;
          console.warn(`[WhatsApp Worker] [DATABASE_UNAVAILABLE] DB unreachable. Backing off for ${Math.round(nextDelayMs)}ms.`);
        }
      } else {
        console.error('[WhatsApp Worker] Poll error:', err instanceof Error ? err.message : String(err));
        nextDelayMs = WHATSAPP_WORKER_POLL_IDLE_MS;
      }
    } finally {
      this.schedulePoll(nextDelayMs);
    }
  }

  private async processJob(job: any): Promise<void> {
    const correlationId = job.correlationId ?? job.id;

    try {
      if (job.jobType === WHATSAPP_JOB_PROCESS_INBOUND) {
        await this.processInboundJob(job, correlationId);
      } else if (job.jobType === WHATSAPP_JOB_SEND_OUTBOUND) {
        await this.processOutboundJob(job, correlationId);
      } else {
        throw new Error(`Unknown job type: ${job.jobType}`);
      }

      await this.jobRepo.markProcessed(job.id, this.workerId);
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      const attempts = job.attempts ?? 1;
      console.error(`[WhatsApp Worker] Job ${job.id} failed (attempt ${attempts}): ${reason}`);
      await this.jobRepo.markFailed(job.id, reason, attempts);
    }
  }

  // ---------------------------------------------------------------------------
  // Private: Inbound Job Processing (AI pipeline)
  // ---------------------------------------------------------------------------

  private async processInboundJob(job: any, correlationId: string): Promise<void> {
    const payload = job.payload as WhatsAppInboundJobPayload;
    const { fromPhone, toPhone, textContent, integrationId } = payload;

    if (!textContent) {
      console.log(`[WhatsApp Worker] Job ${job.id}: no text content, skipping AI processing.`);
      return;
    }

    // Resolve integration (re-resolve to ensure it's still active)
    const integration = await this.integrationRepo.findById(integrationId, job.tenantId);
    if (!integration || !integration.isEnabled) {
      console.log(`[WhatsApp Worker] Job ${job.id}: integration disabled, skipping.`);
      return;
    }

    const ctx = {
      tenantId: job.tenantId,
      clinicId: job.clinicId,
      patientPhone: fromPhone,
      correlationId,
    };

    // Get/create conversation
    const { conversationId, context } = await this.conversationService.getOrCreateConversation(
      job.tenantId,
      job.clinicId,
      fromPhone,
      integrationId,
      correlationId,
    );

    // Update job with conversation ID
    await this.jobRepo.setConversationId(job.id, conversationId);

    // Increment turn count and check limits
    let updatedContext = context;
    try {
      updatedContext = await this.conversationService.incrementTurnAndCheck(
        conversationId, job.tenantId, correlationId
      );
    } catch (err: any) {
      // Rate limit or max turns — send limit message and stop
      const limitMsg = err.message ?? 'Please contact the clinic directly for further assistance.';
      await this.sendReply(integration, fromPhone, limitMsg, conversationId, correlationId, job.tenantId, job.clinicId);
      return;
    }

    // Get clinic info (name, timezone) for the AI prompt — fallback to safe defaults on error.
    // This is critical for correct slot-time interpretation in non-UTC clinics.
    let clinicInfo: Record<string, string> = { name: 'the clinic', timezone: 'UTC' };
    try {
      clinicInfo = await this.bookingService.getClinicInfo(ctx);
    } catch (err) {
      console.warn(
        `[WhatsApp Worker] Could not fetch clinic info for job ${job.id}, using defaults:`,
        err instanceof Error ? err.message : String(err),
      );
    }

    // Run AI orchestrator
    const replyText = await this.orchestrator.processMessage(
      textContent,
      updatedContext,
      integration,
      clinicInfo,
      ctx,
      conversationId,
    );

    // Send reply
    await this.sendReply(integration, fromPhone, replyText, conversationId, correlationId, job.tenantId, job.clinicId);

    // Mark message as processed
    if (payload.messageId) {
      await this.messageRepo.markProcessed(payload.messageId, conversationId);
    }
  }

  private async processOutboundJob(job: any, correlationId: string): Promise<void> {
    // Outbound jobs enqueued directly by sendReply — handled separately if needed
    // Currently outbound is synchronous in sendReply; this is a placeholder for future async outbound
    console.log(`[WhatsApp Worker] Outbound job ${job.id} — processing direct send.`);
  }

  private async sendReply(
    integration: any,
    toPhone: string,
    text: string,
    conversationId: string,
    correlationId: string,
    tenantId: string,
    clinicId: string,
  ): Promise<void> {
    try {
      await this.outboundService.sendTextMessage({
        tenantId,
        clinicId,
        integrationId: integration.id,
        phoneNumberId: integration.phoneNumberId,
        fromPhone: integration.phoneNumber,
        toPhone,
        messageText: text,
        conversationId,
        correlationId,
      });
    } catch (err) {
      console.error('[WhatsApp Worker] Failed to send reply:', err instanceof Error ? err.message : String(err));
    }
  }
}

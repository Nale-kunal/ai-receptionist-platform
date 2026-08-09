/**
 * WhatsApp Job Repository
 *
 * Data access for WhatsAppJob durable queue.
 * Implements the same lease-based atomic claiming pattern as MailQueueService.
 */

import type { PrismaClient } from '@prisma/client';
import type { EnqueueJobParams } from '../interfaces/whatsapp.interfaces';
import {
  WHATSAPP_JOB_STATUS_QUEUED,
  WHATSAPP_JOB_STATUS_PROCESSING,
  WHATSAPP_JOB_STATUS_PROCESSED,
  WHATSAPP_JOB_STATUS_FAILED_RETRYABLE,
  WHATSAPP_JOB_STATUS_FAILED_PERMANENT,
  WHATSAPP_JOB_MAX_ATTEMPTS,
  WHATSAPP_JOB_LEASE_DURATION_MS,
  WHATSAPP_JOB_RETRY_DELAYS_MS,
} from '../constants/whatsapp.constants';
import * as crypto from 'crypto';

export class WhatsAppJobRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Enqueue a job. Uses upsert on idempotencyKey so duplicate enqueues are no-ops.
   */
  public async enqueue(params: EnqueueJobParams): Promise<string> {
    const result = await this.prisma.whatsAppJob.upsert({
      where: { idempotencyKey: params.idempotencyKey },
      update: {},  // Duplicate enqueue → no change (idempotent)
      create: {
        idempotencyKey: params.idempotencyKey,
        tenantId: params.tenantId,
        clinicId: params.clinicId,
        integrationId: params.integrationId,
        conversationId: params.conversationId,
        jobType: params.jobType,
        status: WHATSAPP_JOB_STATUS_QUEUED,
        payload: params.payload as any,
        providerMessageId: params.providerMessageId,
        correlationId: params.correlationId,
        attempts: 0,
        maxAttempts: WHATSAPP_JOB_MAX_ATTEMPTS,
      },
      select: { id: true },
    });
    return result.id;
  }

  /**
   * Atomically claim the next available job using FOR UPDATE SKIP LOCKED.
   * Returns null if no jobs are available.
   */
  public async claimNextJob(workerId: string): Promise<any | null> {
    const leaseId = crypto.randomUUID();
    const leaseExpiresAt = new Date(Date.now() + WHATSAPP_JOB_LEASE_DURATION_MS);
    const now = new Date();

    // Use raw query for FOR UPDATE SKIP LOCKED
    const rows = await this.prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM whatsapp_jobs
      WHERE status = ${WHATSAPP_JOB_STATUS_QUEUED}
        AND (next_attempt_at IS NULL OR next_attempt_at <= ${now})
        AND attempts < max_attempts
      ORDER BY created_at ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    `;

    if (!rows || rows.length === 0) return null;

    const jobId = rows[0]!.id;

    return this.prisma.whatsAppJob.update({
      where: { id: jobId },
      data: {
        status: WHATSAPP_JOB_STATUS_PROCESSING,
        workerId,
        leaseId,
        leaseExpiresAt,
        lastAttemptAt: now,
        attempts: { increment: 1 },
      },
    });
  }

  /**
   * Mark a job as successfully processed (terminal state).
   */
  public async markProcessed(id: string, workerId: string): Promise<void> {
    await this.prisma.whatsAppJob.update({
      where: { id },
      data: {
        status: WHATSAPP_JOB_STATUS_PROCESSED,
        processedAt: new Date(),
        leaseId: null,
        leaseExpiresAt: null,
      },
    });
  }

  /**
   * Mark a job as failed. Decides retryable vs permanent based on attempt count.
   */
  public async markFailed(id: string, reason: string, attempts: number): Promise<void> {
    const isPermanent = attempts >= WHATSAPP_JOB_MAX_ATTEMPTS;
    const retryDelayMs = WHATSAPP_JOB_RETRY_DELAYS_MS[Math.min(attempts - 1, WHATSAPP_JOB_RETRY_DELAYS_MS.length - 1)] ?? 16_000;

    await this.prisma.whatsAppJob.update({
      where: { id },
      data: {
        status: isPermanent ? WHATSAPP_JOB_STATUS_FAILED_PERMANENT : WHATSAPP_JOB_STATUS_FAILED_RETRYABLE,
        failureReason: reason.slice(0, 1000),
        failedAt: isPermanent ? new Date() : undefined,
        leaseId: null,
        leaseExpiresAt: null,
        workerId: null,
        // Schedule retry for retryable failures
        ...(isPermanent ? {} : {
          status: WHATSAPP_JOB_STATUS_QUEUED,
          nextAttemptAt: new Date(Date.now() + retryDelayMs),
        }),
      },
    });
  }

  /**
   * Reclaim jobs with expired leases (crash recovery).
   * Called on worker startup.
   */
  public async reclaimExpiredLeases(): Promise<number> {
    const now = new Date();
    const result = await this.prisma.whatsAppJob.updateMany({
      where: {
        status: WHATSAPP_JOB_STATUS_PROCESSING,
        leaseExpiresAt: { lt: now },
      },
      data: {
        status: WHATSAPP_JOB_STATUS_QUEUED,
        workerId: null,
        leaseId: null,
        leaseExpiresAt: null,
        nextAttemptAt: now,
      },
    });
    return result.count;
  }

  /**
   * Update conversationId on a job once conversation is created/found.
   */
  public async setConversationId(id: string, conversationId: string): Promise<void> {
    await this.prisma.whatsAppJob.update({
      where: { id },
      data: { conversationId },
    });
  }
}

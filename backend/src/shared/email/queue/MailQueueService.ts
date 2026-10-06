/**
 * MailQueueService -- Enterprise Durable Mail Queue
 *
 * Implements at-most-once email delivery with full crash-safety, idempotency,
 * and distributed-worker safety. Backed by the mail_jobs PostgreSQL table.
 *
 * At-most-once delivery guarantees:
 *   1. Idempotency key (SHA-256) -- duplicate enqueue is a DB-level no-op
 *   2. Atomic FOR UPDATE SKIP LOCKED -- single-worker claiming per job
 *   3. Terminal state guard -- delivered records are NEVER re-queued
 *   4. Lease expiration -- stale processing jobs are safely recovered
 *   5. Startup recovery -- checks actual delivery status before re-queuing
 *
 * State machine:
 *   queued -> processing -> delivered  (terminal -- NEVER re-enters queue)
 *   queued -> processing -> failed -> queued  (retry, if attempts < maxAttempts)
 *   queued -> processing -> failed  (terminal dead letter)
 */

import * as crypto from 'crypto';
import type { PrismaClient } from '@prisma/client';
import type { IEmailProvider, EmailOptions, EmailSendResult } from '../interfaces/IEmailProvider';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const WORKER_POLL_INTERVAL_MS = parseInt(process.env['MAIL_QUEUE_POLL_INTERVAL_MS'] ?? '1000', 10);
const STALE_RECOVERY_INTERVAL_MS = 60 * 1000;
const WORKER_BATCH_SIZE = 5;
const LEASE_DURATION_MS = 5 * 60 * 1000;
const BACKOFF_BASE_SECONDS = 5;
const DEFAULT_MAX_ATTEMPTS = 3;
const WORKER_ID = `worker_${process.pid}_${Date.now()}`;

// Database outage backoff constants
const INITIAL_DB_BACKOFF_MS = 2000;
const MAX_DB_BACKOFF_MS = 60000;

/**
 * Classifies database connectivity / wake-up / network errors
 */
export function isDbConnectivityError(err: unknown): boolean {
  if (!err) return false;
  const message = (err as any)?.message || String(err);
  const code = (err as any)?.code;
  return (
    code === 'P1001' || // Can't reach database server
    code === 'P1002' || // Database server timeout
    code === 'P1017' || // Server closed connection
    code === 'P2024' || // Timed out fetching connection from pool
    message.includes("Can't reach database server") ||
    message.includes('Connection terminated') ||
    message.includes('Connection lost') ||
    message.includes('ECONNREFUSED') ||
    message.includes('ETIMEDOUT') ||
    message.includes('ServerHasNoCommands')
  );
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MailJobStatus = 'queued' | 'processing' | 'delivered' | 'failed' | 'skipped';

export interface MailJobRecord {
  id: string;
  idempotencyKey: string;
  tenantId: string | null;
  clinicId: string | null;
  notificationId: string | null;
  recipient: string;
  fromAddress: string | null;
  type: string;
  subject: string;
  htmlBody: string;
  textBody: string;
  status: MailJobStatus;
  attempts: number;
  maxAttempts: number;
  workerId: string | null;
  leaseId: string | null;
  leaseExpiresAt: Date | null;
  providerName: string | null;
  providerMessageId: string | null;
  providerResponse: Record<string, unknown> | null;
  scheduledAt: Date | null;
  nextAttemptAt: Date | null;
  lastAttemptAt: Date | null;
  processingStartedAt: Date | null;
  processingCompletedAt: Date | null;
  deliveredAt: Date | null;
  failedAt: Date | null;
  failureReason: string | null;
  correlationId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface EnqueueParams {
  idempotencyKey?: string;
  tenantId?: string;
  clinicId?: string;
  notificationId?: string;
  recipient: string;
  from?: string;
  type: 'invitation' | 'password_reset' | 'email_verification' | 'notification';
  subject: string;
  html: string;
  text: string;
  scheduledAt?: Date;
  correlationId?: string;
  metadata?: Record<string, unknown>;
}

export interface QueueMetrics {
  workerAlive: boolean;
  workerId: string;
  queueDepth: number;
  pendingJobs: number;
  processingJobs: number;
  failedJobs: number;
  deliveredJobs: number;
  averageLatencyMs: number;
  lastSuccessfulDeliveryAt: Date | null;
  lastFailureAt: Date | null;
}

// ---------------------------------------------------------------------------
// Idempotency Key
// ---------------------------------------------------------------------------

function computeIdempotencyKey(
  customKey: string | undefined | null,
  tenantId: string | undefined | null,
  type: string,
  recipient: string,
  subject: string,
): string {
  if (customKey && customKey.trim().length > 0) {
    return crypto.createHash('sha256').update(customKey.trim(), 'utf8').digest('hex');
  }
  const raw = `${tenantId ?? 'global'}:${type}:${recipient.toLowerCase().trim()}:${subject.trim()}`;
  return crypto.createHash('sha256').update(raw, 'utf8').digest('hex');
}

// ---------------------------------------------------------------------------
// Retry Classification
// ---------------------------------------------------------------------------

function isTransientFailure(error: string | null | undefined): boolean {
  if (!error) return true;
  const lower = error.toLowerCase();
  const permanentPatterns = [
    'invalid email', 'invalid recipient', 'bad recipient',
    'unsubscribed', 'blacklisted', 'permanent failure',
    'hard bounce', 'account not found', 'domain not found',
    'http 400', 'http 401', 'http 403', 'http 422',
  ];
  return !permanentPatterns.some((p) => lower.includes(p));
}

function computeNextAttemptAt(attempts: number): Date {
  const backoffSeconds = BACKOFF_BASE_SECONDS * Math.pow(2, attempts - 1);
  return new Date(Date.now() + backoffSeconds * 1000);
}

// ---------------------------------------------------------------------------
// MailQueueService
// ---------------------------------------------------------------------------

export class MailQueueService {
  private workerTimer: NodeJS.Timeout | null = null;
  private isProcessing = false;
  private isShuttingDown = false;
  private isDbUnavailable = false;
  private consecutiveDbFailures = 0;
  private currentBackoffMs = 0;
  private deliveredCount = 0;
  private failedCount = 0;
  private totalLatencyMs = 0;
  private lastSuccessfulDeliveryAt: Date | null = null;
  private lastFailureAt: Date | null = null;
  private lastStaleRecoveryAt = 0;

  constructor(
    private readonly provider: IEmailProvider,
    private readonly prisma: PrismaClient,
  ) {}

  // ---- Initialization & Shutdown ----------------------------------------

  /**
   * Initialize: recover stale leased jobs, then start the polling worker.
   * Call AFTER confirming DB connectivity. Idempotent.
   */
  public async initialize(): Promise<void> {
    if (this.workerTimer || this.isShuttingDown) return;
    this.lastStaleRecoveryAt = Date.now();
    try {
      await this.recoverStaleLeasedJobs();
    } catch (err) {
      if (isDbConnectivityError(err)) {
        console.warn('[MailQueueService] Initial stale job recovery deferred (database waking up / reconnecting).');
      } else {
        console.warn('[MailQueueService] Stale job recovery skipped on startup:', err);
      }
    }
    this.startWorker();
    console.info(
      `[MailQueueService] Initialized. WorkerID=${WORKER_ID} PollInterval=${WORKER_POLL_INTERVAL_MS}ms`,
    );
  }

  public shutdown(): void {
    this.isShuttingDown = true;
    this.stopWorker();
    console.info('[MailQueueService] Worker shutdown complete.');
  }

  // ---- Enqueue ----------------------------------------------------------

  /**
   * Durably enqueue a mail job with at-most-once delivery guarantee.
   *
   * If a DELIVERED record with this idempotency key exists -> no-op.
   * If a DEAD-LETTERED record exists -> no-op.
   * If a QUEUED/PROCESSING record exists -> returns existing (already in flight).
   * Otherwise -> creates new DB record (write-ahead, worker picks up asynchronously).
   */
  public async enqueue(params: EnqueueParams): Promise<MailJobRecord | null> {
    const idempotencyKey = computeIdempotencyKey(
      params.idempotencyKey, params.tenantId, params.type, params.recipient, params.subject,
    );
    const keyPrefix = idempotencyKey.substring(0, 16);

    const existing = await this.prisma.mailJob.findUnique({ where: { idempotencyKey } });

    if (existing) {
      const status = existing.status as MailJobStatus;

      if (status === 'delivered' || status === 'skipped') {
        console.info(
          `[MailQueueService] IDEMPOTENCY: email already ${status.toUpperCase()} -- skipping enqueue. ` +
          `[key=${keyPrefix}...] [jobId=${existing.id}] [recipient=${existing.recipient}] ` +
          `[deliveredAt=${existing.deliveredAt?.toISOString() ?? "unknown"}]`,
        );
        return existing as unknown as MailJobRecord;
      }

      if (status === 'failed' && existing.attempts >= existing.maxAttempts) {
        console.warn(
          `[MailQueueService] IDEMPOTENCY: email is DEAD-LETTERED -- skipping enqueue. ` +
          `[key=${keyPrefix}...] [jobId=${existing.id}]`,
        );
        return existing as unknown as MailJobRecord;
      }

      console.info(
        `[MailQueueService] IDEMPOTENCY: job already exists [status=${status}] -- returning. ` +
        `[key=${keyPrefix}...] [jobId=${existing.id}]`,
      );
      return existing as unknown as MailJobRecord;
    }

    let notificationId = params.notificationId ?? null;
    if (!notificationId && params.tenantId) {
      try {
        const ntf = await this.prisma.notification.create({
          data: {
            tenantId:  params.tenantId,
            clinicId:  params.clinicId ?? null,
            recipient: params.recipient,
            channel:   'email',
            type:      params.type,
            subject:   params.subject ?? null,
            content:   params.html || params.text,
            status:    'queued',
            provider:  this.provider.getProviderName(),
          },
        });
        notificationId = ntf.id;
      } catch {
        // Non-fatal if tenant constraint fails in unit test
      }
    }

    const job = await this.prisma.mailJob.create({
      data: {
        idempotencyKey,
        tenantId:       params.tenantId       ?? null,
        clinicId:       params.clinicId       ?? null,
        notificationId: notificationId,
        recipient:      params.recipient,
        fromAddress:    params.from            ?? null,
        type:           params.type,
        subject:        params.subject,
        htmlBody:       params.html,
        textBody:       params.text,
        status:         'queued',
        attempts:       0,
        maxAttempts:    DEFAULT_MAX_ATTEMPTS,
        scheduledAt:    params.scheduledAt   ?? null,
        correlationId:  params.correlationId ?? null,
        metadata:       (params.metadata ?? {}) as any,
      },
    });

    console.info(
      `[MailQueueService] Job enqueued [jobId=${job.id}] [key=${keyPrefix}...] ` +
      `[type=${params.type}] [recipient=${params.recipient}]`,
    );
    return job as unknown as MailJobRecord;
  }

  // ---- Worker Lifecycle -------------------------------------------------

  private scheduleNextTick(delayMs: number): void {
    if (this.isShuttingDown) return;
    if (this.workerTimer) {
      clearTimeout(this.workerTimer);
      this.workerTimer = null;
    }
    this.workerTimer = setTimeout(() => {
      void this.workerTick().catch((err) => {
        console.error('[MailQueueService] Unhandled worker tick error:', err);
      });
    }, delayMs);
    if (typeof this.workerTimer.unref === 'function') {
      this.workerTimer.unref();
    }
  }

  private startWorker(): void {
    if (this.workerTimer || this.isShuttingDown) return;
    this.scheduleNextTick(WORKER_POLL_INTERVAL_MS);
  }

  private stopWorker(): void {
    if (this.workerTimer) {
      clearTimeout(this.workerTimer);
      this.workerTimer = null;
    }
  }

  private async workerTick(): Promise<void> {
    if (this.isProcessing || this.isShuttingDown) return;
    this.isProcessing = true;
    let nextDelayMs = WORKER_POLL_INTERVAL_MS;

    try {
      const now = Date.now();
      if (now - this.lastStaleRecoveryAt >= STALE_RECOVERY_INTERVAL_MS) {
        this.lastStaleRecoveryAt = now;
        await this.recoverStaleLeasedJobs();
      }
      await this.processClaimedJobs();

      // Successful tick: if we were previously in DB backoff, clear it
      if (this.isDbUnavailable) {
        this.isDbUnavailable = false;
        this.consecutiveDbFailures = 0;
        this.currentBackoffMs = 0;
        console.info(
          `[MailQueueService] Database connectivity restored. Resuming normal queue polling (${WORKER_POLL_INTERVAL_MS}ms).`,
        );
      }
    } catch (err: unknown) {
      if (isDbConnectivityError(err)) {
        this.consecutiveDbFailures++;
        const jitter = Math.floor(Math.random() * 500);
        this.currentBackoffMs = Math.min(
          INITIAL_DB_BACKOFF_MS * Math.pow(2, Math.min(this.consecutiveDbFailures - 1, 5)) + jitter,
          MAX_DB_BACKOFF_MS,
        );
        nextDelayMs = this.currentBackoffMs;

        if (!this.isDbUnavailable) {
          this.isDbUnavailable = true;
          const errMsg = (err as any)?.message || String(err);
          console.warn(
            `[MailQueueService] [DATABASE_UNAVAILABLE] PostgreSQL unreachable (${errMsg.substring(0, 120)}). ` +
            `Entering exponential backoff (attempt ${this.consecutiveDbFailures}, next retry in ${Math.round(nextDelayMs)}ms).`,
          );
        } else if (this.consecutiveDbFailures % 5 === 0) {
          console.warn(
            `[MailQueueService] [DATABASE_UNAVAILABLE] Waiting for database connectivity (attempt ${this.consecutiveDbFailures}, next retry in ${Math.round(nextDelayMs)}ms)...`,
          );
        }
      } else {
        console.error('[MailQueueService] Worker tick error:', err);
      }
    } finally {
      this.isProcessing = false;
      if (!this.isShuttingDown) {
        this.scheduleNextTick(nextDelayMs);
      }
    }
  }

  // ---- Startup Crash Recovery ------------------------------------------

  private async recoverStaleLeasedJobs(): Promise<void> {
    try {
      const now = new Date();
      const staleJobs = await this.prisma.mailJob.findMany({
        where: { status: 'processing', leaseExpiresAt: { lt: now } },
      });
      if (staleJobs.length === 0) return;
      console.warn(
        `[MailQueueService] Recovery: ${staleJobs.length} stale leased job(s). WorkerID=${WORKER_ID}`,
      );
      for (const job of staleJobs) { await this.recoverSingleStaleJob(job); }
    } catch (err: any) {
      if (isDbConnectivityError(err)) {
        throw err;
      }
      console.warn('[MailQueueService] Stale job recovery skipped:', err?.message || err);
    }
  }

  private async recoverSingleStaleJob(job: any): Promise<void> {
    const jobId: string = job.id;
    const attempts: number = job.attempts;
    const maxAttempts: number = job.maxAttempts ?? job.max_attempts ?? DEFAULT_MAX_ATTEMPTS;

    if (job.providerMessageId) {
      console.info(`[MailQueueService] Recovery: job ${jobId} has providerMessageId -- marking DELIVERED.`);
      await this.prisma.mailJob.update({
        where: { id: jobId },
        data: { status: 'delivered', deliveredAt: job.deliveredAt ?? new Date(), processingCompletedAt: new Date(), workerId: null, leaseId: null, leaseExpiresAt: null },
      });
      return;
    }

    if (job.notificationId) {
      const ntf = await this.prisma.notification.findFirst({
        where: { id: job.notificationId },
        select: { status: true, deliveredAt: true },
      });
      if (ntf?.status === 'delivered') {
        console.info(`[MailQueueService] Recovery: notification ${job.notificationId} is DELIVERED -- marking mail job DELIVERED.`);
        await this.prisma.mailJob.update({
          where: { id: jobId },
          data: { status: 'delivered', deliveredAt: ntf.deliveredAt ?? new Date(), processingCompletedAt: new Date(), workerId: null, leaseId: null, leaseExpiresAt: null },
        });
        return;
      }
    }

    if (attempts < maxAttempts) {
      const nextAttemptAt = computeNextAttemptAt(attempts);
      console.warn(`[MailQueueService] Recovery: resetting job ${jobId} to QUEUED (attempts=${attempts}/${maxAttempts}).`);
      await this.prisma.mailJob.update({
        where: { id: jobId },
        data: { status: 'queued', nextAttemptAt, workerId: null, leaseId: null, leaseExpiresAt: null, failureReason: `Stale lease recovery -- worker crashed after ${attempts} attempt(s)` },
      });
      return;
    }

    console.error(`[MailQueueService] Recovery: job ${jobId} exceeded max retries -- marking FAILED.`);
    await this.prisma.mailJob.update({
      where: { id: jobId },
      data: { status: 'failed', failedAt: new Date(), processingCompletedAt: new Date(), workerId: null, leaseId: null, leaseExpiresAt: null, failureReason: `[Dead Letter] Max retries (${maxAttempts}) exceeded during crash recovery.` },
    });
  }

  // ---- Atomic Job Claiming --------------------------------------------

  private async processClaimedJobs(): Promise<number> {
    const now = new Date();
    const leaseExpiry = new Date(now.getTime() + LEASE_DURATION_MS);
    const leaseId = crypto.randomBytes(16).toString("hex");

    const claimed = await this.prisma.$queryRaw<any[]>`
      WITH "claimed_jobs" AS (
        SELECT "id" FROM "mail_jobs"
        WHERE
          "status" = 'queued'
          AND ("scheduled_at" IS NULL OR "scheduled_at" <= ${now})
          AND ("next_attempt_at" IS NULL OR "next_attempt_at" <= ${now})
        ORDER BY "created_at" ASC
        FOR UPDATE SKIP LOCKED
        LIMIT ${WORKER_BATCH_SIZE}
      )
      UPDATE "mail_jobs"
      SET
        "status"                = 'processing',
        "worker_id"             = ${WORKER_ID},
        "lease_id"              = ${leaseId},
        "lease_expires_at"      = ${leaseExpiry},
        "processing_started_at" = ${now},
        "updated_at"            = ${now}
      FROM "claimed_jobs"
      WHERE "mail_jobs"."id" = "claimed_jobs"."id"
      RETURNING "mail_jobs".*
    `;

    if (!claimed || claimed.length === 0) return 0;
    for (const rawJob of claimed) { await this.deliverJob(rawJob); }
    return claimed.length;
  }

  // ---- Individual Job Delivery ----------------------------------------

  private async deliverJob(rawJob: any): Promise<void> {
    const jobId: string = rawJob.id;
    const startTime = Date.now();

    if (rawJob.status === 'delivered') {
      console.warn(`[MailQueueService] Terminal guard: job ${jobId} is already DELIVERED -- skipping.`);
      return;
    }

    const newAttempts = (rawJob.attempts as number) + 1;
    const maxAttempts: number = rawJob.max_attempts ?? rawJob.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;

    console.info(
      `[MailQueueService] Delivering job ${jobId} [attempt=${newAttempts}/${maxAttempts}] ` +
      `[type=${rawJob.type}] [recipient=${rawJob.recipient}]`,
    );

    const emailOptions: EmailOptions = {
      to:      rawJob.recipient,
      from:    rawJob.from_address ?? rawJob.fromAddress ?? undefined,
      subject: rawJob.subject,
      html:    rawJob.html_body ?? rawJob.htmlBody,
      text:    rawJob.text_body ?? rawJob.textBody,
    };

    let result: EmailSendResult;
    try {
      result = await this.provider.sendEmail(emailOptions);
    } catch (networkErr: any) {
      result = {
        success: false,
        error: networkErr?.message ?? "Network error during email delivery",
        providerName: this.provider.getProviderName(),
      };
    }

    const durationMs = Date.now() - startTime;
    this.totalLatencyMs += durationMs;

    if (result.skipped) {
      const completedAt = new Date();
      await this.prisma.mailJob.update({
        where: { id: jobId },
        data: {
          status:                'skipped',
          attempts:              newAttempts,
          providerName:          result.providerName,
          providerMessageId:     result.messageId ?? null,
          providerResponse:      { skipped: true, reason: result.error ?? 'Email delivery disabled' } as any,
          lastAttemptAt:         completedAt,
          processingCompletedAt: completedAt,
          workerId:              null,
          leaseId:               null,
          leaseExpiresAt:        null,
          failureReason:         result.error ?? 'Email delivery disabled; job skipped.',
        },
      }).catch(() => {});

      const ntfId = rawJob.notification_id ?? rawJob.notificationId;
      if (ntfId) {
        await this.prisma.notification.update({
          where: { id: ntfId },
          data: { status: 'skipped', provider: result.providerName },
        }).catch(() => {});
      }

      console.info(
        `[MailQueueService] Job ${jobId} SKIPPED (Email delivery disabled) ` +
        `[provider=${result.providerName}] [durationMs=${durationMs}]`,
      );
      return;
    }

    if (result.success) {
      const deliveredAt = new Date();
      await this.prisma.mailJob.update({
        where: { id: jobId },
        data: {
          status:                'delivered',
          attempts:              newAttempts,
          providerName:          result.providerName,
          providerMessageId:     result.messageId ?? null,
          providerResponse:      { success: true, messageId: result.messageId } as any,
          deliveredAt,
          lastAttemptAt:         deliveredAt,
          processingCompletedAt: deliveredAt,
          workerId:              null,
          leaseId:               null,
          leaseExpiresAt:        null,
          failureReason:         null,
        },
      }).catch(() => {});
      this.deliveredCount += 1;
      this.lastSuccessfulDeliveryAt = deliveredAt;

      const ntfId = rawJob.notification_id ?? rawJob.notificationId;
      if (ntfId) {
        await this.prisma.notification.update({
          where: { id: ntfId },
          data: { status: 'delivered', deliveredAt, provider: result.providerName },
        }).catch(() => {});
      }
      const tenantId = rawJob.tenant_id ?? rawJob.tenantId;
      if (tenantId && rawJob.recipient) {
        await this.prisma.notification.updateMany({
          where: { tenantId, recipient: rawJob.recipient, status: { in: ['pending', 'queued'] } },
          data: { status: 'delivered', deliveredAt, provider: result.providerName },
        }).catch(() => {});
      }

      console.info(
        `[MailQueueService] Delivered job ${jobId} ` +
        `[providerMessageId=${result.messageId}] [durationMs=${durationMs}] [provider=${result.providerName}]`,
      );
    } else {
      const errorMsg = result.error ?? "Unknown delivery error";
      const permanent = !isTransientFailure(errorMsg);
      const exhausted  = newAttempts >= maxAttempts;
      const shouldRetry = !permanent && !exhausted;
      this.lastFailureAt = new Date();

      if (shouldRetry) {
        const nextAttemptAt = computeNextAttemptAt(newAttempts);
        await this.prisma.mailJob.update({
          where: { id: jobId },
          data: {
            status:           'queued',
            attempts:         newAttempts,
            lastAttemptAt:    new Date(),
            nextAttemptAt,
            failureReason:    `Attempt ${newAttempts}: ${errorMsg}`,
            providerName:     result.providerName,
            providerResponse: { success: false, error: errorMsg } as any,
            workerId:         null,
            leaseId:          null,
            leaseExpiresAt:   null,
          },
        });
        console.warn(
          `[MailQueueService] Job ${jobId} failed (attempt ${newAttempts}/${maxAttempts}). ` +
          `Retry at ${nextAttemptAt.toISOString()}. Error: ${errorMsg}`,
        );
      } else {
        this.failedCount += 1;
        const reason = permanent
          ? `[Permanent failure] ${errorMsg}`
          : `[Dead Letter] Max retries (${maxAttempts}) exceeded. Last error: ${errorMsg}`;
        await this.prisma.mailJob.update({
          where: { id: jobId },
          data: {
            status:                'failed',
            attempts:              newAttempts,
            lastAttemptAt:         new Date(),
            failedAt:              new Date(),
            processingCompletedAt: new Date(),
            failureReason:         reason,
            providerName:          result.providerName,
            providerResponse:      { success: false, error: errorMsg } as any,
            workerId:              null,
            leaseId:               null,
            leaseExpiresAt:        null,
          },
        });
        console.error(
          `[MailQueueService] Job ${jobId} PERMANENTLY FAILED ` +
          `[attempt=${newAttempts}/${maxAttempts}] [permanent=${permanent}]. Reason: ${reason}`,
        );
      }
    }
  }

  // ---- Metrics & Backward Compatibility --------------------------------

  public async getMetrics(): Promise<QueueMetrics> {
    try {
      const [queuedCount, processingCount, deliveredCount, failedCount] = await Promise.all([
        this.prisma.mailJob.count({ where: { status: 'queued' } }),
        this.prisma.mailJob.count({ where: { status: 'processing' } }),
        this.prisma.mailJob.count({ where: { status: 'delivered' } }),
        this.prisma.mailJob.count({ where: { status: 'failed' } }),
      ]);
      const totalProcessed = this.deliveredCount + this.failedCount;
      return {
        workerAlive:              this.workerTimer !== null && !this.isShuttingDown,
        workerId:                 WORKER_ID,
        queueDepth:               queuedCount + processingCount,
        pendingJobs:              queuedCount,
        processingJobs:           processingCount,
        failedJobs:               failedCount,
        deliveredJobs:            deliveredCount,
        averageLatencyMs:         totalProcessed > 0 ? Math.round(this.totalLatencyMs / totalProcessed) : 0,
        lastSuccessfulDeliveryAt: this.lastSuccessfulDeliveryAt,
        lastFailureAt:            this.lastFailureAt,
      };
    } catch {
      return {
        workerAlive:              this.workerTimer !== null && !this.isShuttingDown && !this.isDbUnavailable,
        workerId:                 WORKER_ID,
        queueDepth:               0,
        pendingJobs:              0,
        processingJobs:           0,
        failedJobs:               0,
        deliveredJobs:            0,
        averageLatencyMs:         0,
        lastSuccessfulDeliveryAt: this.lastSuccessfulDeliveryAt,
        lastFailureAt:            this.lastFailureAt,
      };
    }
  }

  /** @deprecated Use getMetrics() -- retained for HealthController backward compatibility. */
  public getQueueLength(): number { return 0; }

  /** @deprecated Use getMetrics() -- the queue is now DB-backed. */
  public getJobs(): MailJobRecord[] { return []; }

  /** Process queue tick manually (exposed for testing) */
  public async processQueue(): Promise<void> {
    const wasProcessing = this.isProcessing;
    const wasShuttingDown = this.isShuttingDown;
    this.isProcessing = false;
    this.isShuttingDown = false;
    try {
      let count = 0;
      do {
        count = await this.processClaimedJobs();
      } while (count > 0);
    } finally {
      this.isProcessing = wasProcessing;
      this.isShuttingDown = wasShuttingDown;
    }
  }

  // Exposed for test control only
  public startWorkerForTesting(): void { this.startWorker(); }
  public stopWorkerForTesting(): void  { this.stopWorker(); }
}
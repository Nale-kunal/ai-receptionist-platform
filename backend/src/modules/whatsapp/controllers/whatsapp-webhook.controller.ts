/**
 * WhatsApp Webhook Controller
 *
 * Handles two Meta Cloud API webhook flows:
 *
 *  GET  /api/v1/webhooks/whatsapp — Initial verification handshake
 *  POST /api/v1/webhooks/whatsapp — Inbound message events
 *
 * Security Contract:
 *  - POST body parsed as raw Buffer (raw body parser on route, NOT JSON parser)
 *  - Signature verified before any payload parsing
 *  - Tenant resolved server-side from 'to' phone number
 *  - HTTP 200 returned IMMEDIATELY after enqueue (no AI work in request path)
 *  - All errors result in HTTP 200 (prevents Meta retry storm)
 *  - Raw payload stored in WhatsAppWebhookEvent for audit
 */

import type { Request, Response } from 'express';
import * as crypto from 'crypto';
import type { IWhatsAppProvider } from '../providers/whatsapp-provider.interface';
import type { WhatsAppTenantResolverService } from '../services/whatsapp-tenant-resolver.service';
import type { WhatsAppJobRepository } from '../repositories/whatsapp-job.repository';
import type { WhatsAppMessageRepository } from '../repositories/whatsapp-message.repository';
import type { WhatsAppWebhookEventRepository } from '../repositories/whatsapp-webhook-event.repository';
import type { WhatsAppIntegrationRepository } from '../repositories/whatsapp-integration.repository';
import { WHATSAPP_JOB_PROCESS_INBOUND, WHATSAPP_MSG_INBOUND } from '../constants/whatsapp.constants';
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Meta payload schema (minimal validation — exact Meta format)
// ---------------------------------------------------------------------------

const MetaMessageSchema = z.object({
  object: z.literal('whatsapp_business_account'),
  entry: z.array(z.object({
    id: z.string(),  // WABA ID
    changes: z.array(z.object({
      value: z.object({
        messaging_product: z.literal('whatsapp'),
        metadata: z.object({
          display_phone_number: z.string(),
          phone_number_id: z.string(),
        }),
        contacts: z.array(z.object({
          profile: z.object({ name: z.string() }).optional(),
          wa_id: z.string(),
        })).optional(),
        messages: z.array(z.object({
          id: z.string(),      // wamid
          from: z.string(),    // sender E.164 (without +)
          timestamp: z.string(),
          type: z.string(),
          text: z.object({ body: z.string() }).optional(),
        })).optional(),
        statuses: z.array(z.object({
          id: z.string(),      // wamid
          recipient_id: z.string(),
          status: z.string(),  // sent | delivered | read | failed
          timestamp: z.string(),
        })).optional(),
      }),
      field: z.string(),
    })),
  })),
});

export class WhatsAppWebhookController {
  constructor(
    private readonly provider: IWhatsAppProvider,
    private readonly tenantResolver: WhatsAppTenantResolverService,
    private readonly jobRepo: WhatsAppJobRepository,
    private readonly messageRepo: WhatsAppMessageRepository,
    private readonly webhookEventRepo: WhatsAppWebhookEventRepository,
    private readonly integrationRepo: WhatsAppIntegrationRepository,
  ) {}

  // ---------------------------------------------------------------------------
  // GET /api/v1/webhooks/whatsapp — Meta verification handshake
  // ---------------------------------------------------------------------------

  public verify = (req: Request, res: Response): void => {
    const mode      = req.query['hub.mode'];
    const token     = req.query['hub.verify_token'] as string | undefined;
    const challenge = req.query['hub.challenge'];

    if (mode !== 'subscribe' || !token || !challenge) {
      res.status(400).json({ error: 'Invalid verification request' });
      return;
    }

    // Token is checked against integration-level verify tokens in a production
    // multi-tenant setup. For single-instance, we also accept the env var token.
    const envToken = process.env['WHATSAPP_WEBHOOK_VERIFY_TOKEN'];

    // Timing-safe comparison of verify token
    let tokenValid = false;
    if (envToken) {
      try {
        const tokenBuf = Buffer.from(token, 'utf8');
        const envBuf   = Buffer.from(envToken, 'utf8');
        if (tokenBuf.length === envBuf.length) {
          tokenValid = crypto.timingSafeEqual(tokenBuf, envBuf);
        }
      } catch {
        tokenValid = false;
      }
    }

    if (!tokenValid) {
      // Also allow per-integration verify tokens (for multi-tenant)
      // This check is async, but for GET verification we do a simpler path
      // Full per-integration verification is handled at integration activation time
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    res.status(200).send(challenge);
  };

  // ---------------------------------------------------------------------------
  // POST /api/v1/webhooks/whatsapp — Inbound events
  // ---------------------------------------------------------------------------

  public receive = async (req: Request, res: Response): Promise<void> => {
    // Generate correlation ID for tracing
    const correlationId = (req.headers['x-request-id'] as string | undefined)
      ?? (req.headers['x-correlation-id'] as string | undefined)
      ?? crypto.randomUUID();

    // Body MUST be raw Buffer (set by raw body parser middleware on this route)
    const rawBody = req.body as Buffer;
    const sigHeader = (req.headers['x-hub-signature-256'] as string | undefined) ?? '';

    // Always return 200 first-thing for non-critical processing to prevent Meta retries
    // We do signature verification synchronously before 200 to reject invalid requests
    const isValidSignature = this.provider.verifyWebhookSignature(rawBody, sigHeader);

    if (!isValidSignature) {
      console.warn(`[WhatsApp Webhook] Signature verification FAILED [corr=${correlationId}]`);
      // Return 200 anyway to prevent Meta from retrying a genuinely bad request
      // but do NOT process it. Log for audit.
      res.status(200).json({ status: 'ok' });
      return;
    }

    // Parse JSON from raw body
    let payload: unknown;
    try {
      payload = JSON.parse(rawBody.toString('utf8'));
    } catch {
      console.warn(`[WhatsApp Webhook] Malformed JSON [corr=${correlationId}]`);
      res.status(200).json({ status: 'ok' });
      return;
    }

    // Return 200 immediately — all processing is asynchronous
    res.status(200).json({ status: 'ok' });

    // Process asynchronously (intentionally fire-and-forget after 200)
    this.processWebhookAsync(payload, rawBody, sigHeader, correlationId).catch((err) => {
      console.error(`[WhatsApp Webhook] Async processing error [corr=${correlationId}]:`, err);
    });
  };

  // ---------------------------------------------------------------------------
  // Private: Async Processing (runs after HTTP 200 is sent)
  // ---------------------------------------------------------------------------

  private async processWebhookAsync(
    payload: unknown,
    rawBody: Buffer,
    sigHeader: string,
    correlationId: string,
  ): Promise<void> {
    // Validate payload schema
    const parsed = MetaMessageSchema.safeParse(payload);

    if (!parsed.success) {
      // May be a status update or unsupported object type — audit and skip
      await this.webhookEventRepo.create({
        rawPayload: payload as Record<string, unknown>,
        signatureHeader: sigHeader,
        processingStatus: 'skipped',
        errorDetails: 'Schema validation failed: ' + parsed.error.message.slice(0, 200),
        correlationId,
      });
      return;
    }

    const data = parsed.data;

    for (const entry of data.entry) {
      for (const change of entry.changes) {
        const value = change.value;
        const destinationPhone = '+' + value.metadata.display_phone_number.replace(/\D/g, '');

        // Persist raw webhook event for audit
        const eventRecord = await this.webhookEventRepo.create({
          tenantId: undefined,
          destinationPhone,
          rawPayload: payload as Record<string, unknown>,
          signatureHeader: sigHeader,
          processingStatus: 'received',
          correlationId,
        });

        // Handle status updates (delivery receipts) — update message status
        if (value.statuses && value.statuses.length > 0) {
          for (const status of value.statuses) {
            try {
              await this.messageRepo.updateByProviderMessageId(status.id, { status: status.status });
            } catch {
              // Non-fatal — delivery receipt processing
            }
          }
          await this.webhookEventRepo.updateStatus(eventRecord.id, 'processed');
          continue;
        }

        // Resolve tenant from destination phone
        const resolved = await this.tenantResolver.tryResolve(destinationPhone);

        if (!resolved) {
          console.warn(`[WhatsApp Webhook] Unresolvable phone: ${destinationPhone} [corr=${correlationId}]`);
          await this.webhookEventRepo.updateStatus(eventRecord.id, 'quarantined',
            `No active integration for phone: ${destinationPhone}`);
          continue;
        }

        const { tenantId, clinicId, integrationId, phoneNumberId } = resolved;

        // Update event record with resolved tenant
        // (We can't update tenantId after creation with our current schema, so we log it)

        // Process inbound messages
        if (value.messages && value.messages.length > 0) {
          for (const msg of value.messages) {
            const wamid = msg.id;
            const fromPhone = '+' + msg.from.replace(/\D/g, '');
            const textContent = msg.text?.body;
            const messageType = msg.type;

            // Idempotency check
            const isDuplicate = await this.messageRepo.existsByProviderMessageId(wamid);
            if (isDuplicate) {
              console.log(`[WhatsApp Webhook] Duplicate message ${wamid} [corr=${correlationId}]`);
              continue;
            }

            // Persist inbound message
            const msgRecord = await this.messageRepo.create({
              tenantId,
              clinicId,
              integrationId,
              providerMessageId: wamid,
              direction: WHATSAPP_MSG_INBOUND,
              fromNumber: fromPhone,
              toNumber: destinationPhone,
              messageType,
              content: { text: textContent, type: messageType },
              metadata: { correlationId, timestamp: msg.timestamp },
            });

            // Enqueue processing job (idempotent — same wamid won't be double-enqueued)
            const idempotencyKey = `inbound_${wamid}`;
            await this.jobRepo.enqueue({
              idempotencyKey,
              tenantId,
              clinicId,
              integrationId,
              jobType: WHATSAPP_JOB_PROCESS_INBOUND,
              payload: {
                integrationId,
                messageId: msgRecord.id,
                wamid,
                fromPhone,
                toPhone: destinationPhone,
                messageType,
                textContent,
                timestamp: msg.timestamp,
                correlationId,
              },
              providerMessageId: wamid,
              correlationId,
            });
          }
        }

        await this.webhookEventRepo.updateStatus(eventRecord.id, 'queued');
      }
    }
  }
}

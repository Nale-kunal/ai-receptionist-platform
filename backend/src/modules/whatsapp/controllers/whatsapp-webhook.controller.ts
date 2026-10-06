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
    const challenge = req.query['hub.challenge'] as string | undefined;

    if (mode !== 'subscribe' || !token || !challenge) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    // Platform-level Meta Webhook verification token (Option A)
    const envToken = process.env['WHATSAPP_WEBHOOK_VERIFY_TOKEN'];

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
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    // Return challenge text with 200 OK per Meta specifications
    res.status(200).send(challenge);
  };

  // ---------------------------------------------------------------------------
  // POST /api/v1/webhooks/whatsapp — Inbound events
  // ---------------------------------------------------------------------------

  public receive = async (req: Request, res: Response): Promise<void> => {
    const correlationId = (req.headers['x-request-id'] as string | undefined)
      ?? (req.headers['x-correlation-id'] as string | undefined)
      ?? crypto.randomUUID();

    // Body MUST be a raw Buffer (guaranteed by route-level express.raw)
    const rawBody = req.body;
    if (!Buffer.isBuffer(rawBody)) {
      console.warn(`[WhatsApp Webhook] Body is not a Buffer (middleware misconfiguration) [corr=${correlationId}]`);
      res.status(400).json({ error: 'Invalid request body format' });
      return;
    }

    const sigHeader = (req.headers['x-hub-signature-256'] as string | undefined) ?? '';
    if (!sigHeader) {
      console.warn(`[WhatsApp Webhook] Missing X-Hub-Signature-256 header [corr=${correlationId}]`);
      res.status(401).json({ error: 'Missing webhook signature' });
      return;
    }

    const isValidSignature = this.provider.verifyWebhookSignature(rawBody, sigHeader);
    if (!isValidSignature) {
      console.warn(`[WhatsApp Webhook] Signature verification FAILED [corr=${correlationId}]`);
      res.status(401).json({ error: 'Invalid webhook signature' });
      return;
    }

    // Parse JSON from validated raw body
    let payload: unknown;
    try {
      payload = JSON.parse(rawBody.toString('utf8'));
    } catch {
      console.warn(`[WhatsApp Webhook] Malformed JSON [corr=${correlationId}]`);
      res.status(400).json({ error: 'Malformed JSON payload' });
      return;
    }

    // Return 200 immediately to Meta — all processing is asynchronous
    res.status(200).json({ status: 'ok' });

    // Process asynchronously (fire-and-forget after HTTP 200)
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
      const wabaId = entry.id;

      for (const change of entry.changes) {
        const value = change.value;
        const metaPhoneNumberId = value.metadata.phone_number_id;
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
              // Non-fatal delivery receipt processing
            }
          }
          await this.webhookEventRepo.updateStatus(eventRecord.id, 'processed');
          continue;
        }

        // Multi-tenant resolution: match by Meta phone_number_id and verify WABA ID boundary
        const resolved = await this.tenantResolver.tryResolveByMeta(metaPhoneNumberId, wabaId, destinationPhone);

        if (!resolved) {
          console.warn(`[WhatsApp Webhook] Unresolvable channel: pnId=${metaPhoneNumberId} waba=${wabaId} [corr=${correlationId}]`);
          await this.webhookEventRepo.updateStatus(
            eventRecord.id,
            'quarantined',
            `No active integration for phone_number_id: ${metaPhoneNumberId} (WABA: ${wabaId})`,
          );
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

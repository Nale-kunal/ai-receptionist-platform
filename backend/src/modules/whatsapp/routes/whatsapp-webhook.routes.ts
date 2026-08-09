/**
 * WhatsApp Webhook Route
 *
 * CRITICAL: The raw body parser is applied per-route here, not globally.
 * express.json() must NOT be applied to this path (breaks HMAC verification).
 */

import { Router } from 'express';
import express from 'express';
import type { WhatsAppWebhookController } from '../controllers/whatsapp-webhook.controller';
import { WHATSAPP_WEBHOOK_MAX_BODY_BYTES } from '../constants/whatsapp.constants';

export function createWhatsAppWebhookRouter(controller: WhatsAppWebhookController): Router {
  const router = Router();

  // GET — Meta verification handshake (no body parser needed)
  router.get('/', controller.verify);

  // POST — Inbound events: raw body parser MUST come before any JSON middleware
  router.post(
    '/',
    express.raw({
      type: 'application/json',
      limit: WHATSAPP_WEBHOOK_MAX_BODY_BYTES,
    }),
    controller.receive,
  );

  return router;
}

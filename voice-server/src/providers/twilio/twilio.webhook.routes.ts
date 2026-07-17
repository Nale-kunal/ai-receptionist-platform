/**
 * Twilio Voice Provider — Webhook Routes
 */

import { Router } from 'express';
import type { RequestHandler } from 'express';
import type { TwilioWebhookController } from './twilio.webhook.controller';
import { TWILIO_ROUTE_INBOUND, TWILIO_ROUTE_STATUS } from './twilio.constants';

export function createTwilioWebhookRoutes(controller: TwilioWebhookController): Router {
  const router = Router();

  // Twilio HTTP POST callbacks
  router.post(
    TWILIO_ROUTE_INBOUND,
    controller.handleInboundCall as unknown as RequestHandler,
  );

  router.post(
    TWILIO_ROUTE_STATUS,
    controller.handleStatusCallback as unknown as RequestHandler,
  );

  return router;
}

/**
 * Twilio Voice Provider — Webhook Controller
 *
 * Exposes entry HTTP endpoints for Twilio callback hooks.
 */

import type { Request, Response, NextFunction } from 'express';
import { TwilioSecurityValidator } from './twilio.security.validator';
import { validateWebhookPayload } from './twilio.validators';
import { WebhookValidationFailure } from './twilio.errors';
import type { IVoiceSessionManager } from '../../interfaces/voice-server.interfaces';
import { TwilioVoiceSessionManager } from './twilio.voice-session.manager';
import type { TwilioProviderConfig } from './twilio.config';
import { TWILIO_SIGNATURE_HEADER } from './twilio.constants';

export class TwilioWebhookController {
  constructor(
    private readonly config: TwilioProviderConfig,
    private readonly securityValidator: TwilioSecurityValidator,
    private readonly voiceSessionManager: IVoiceSessionManager,
    private readonly twilioSessionManager: TwilioVoiceSessionManager,
  ) {}

  private getRequestUrl(req: Request): string {
    let host = req.headers.host ?? 'localhost';
    if (host.includes(':')) {
      host = host.split(':')[0]!;
    }
    return `${req.protocol}://${host}${req.originalUrl}`;
  }

  public handleInboundCall = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const signature = req.headers[TWILIO_SIGNATURE_HEADER] as string;
      const requestUrl = this.getRequestUrl(req);

      // Extract raw params and body
      const params = { ...req.query, ...req.body } as Record<string, string>;

      // 1. Signature Verification
      this.securityValidator.validateSignature(requestUrl, params, signature);

      // 2. Body Payload Validation
      validateWebhookPayload(req.body);

      const callSid = req.body['CallSid'] as string;
      const accountSid = req.body['AccountSid'] as string;
      const from = req.body['From'] as string;
      const to = req.body['To'] as string;

      // Rate limit check
      const tenantId = req.body['TenantId'] as string ?? 'default-tenant';
      if (!this.voiceSessionManager.rateLimitCheck(tenantId)) {
        res.status(429).send('Rate limit exceeded. Try again later.');
        return;
      }

      // Create internal voice session
      const voiceSession = await this.voiceSessionManager.createSession({
        tenantId,
        clinicId: null,
        provider: 'twilio',
        providerCallId: callSid,
        metadata: { from, to, accountSid },
      });

      // Register inside provider manager
      this.twilioSessionManager.createSession(
        voiceSession.sessionId,
        callSid,
        tenantId,
        null,
        { from, to },
      );

      // 3. Output XML TwiML connecting the call to the Media Stream WebSocket
      res.type('text/xml');
      res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="${this.config.mediaStreamUrl}">
      <Parameter name="sessionId" value="${voiceSession.sessionId}" />
      <Parameter name="tenantId" value="${tenantId}" />
    </Stream>
  </Connect>
</Response>`);
    } catch (err) {
      if (err instanceof WebhookValidationFailure) {
        res.status(401).send(err.message);
        return;
      }
      next(err);
    }
  };

  public handleStatusCallback = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const signature = req.headers[TWILIO_SIGNATURE_HEADER] as string;
      const requestUrl = this.getRequestUrl(req);
      const params = { ...req.query, ...req.body } as Record<string, string>;

      this.securityValidator.validateSignature(requestUrl, params, signature);

      validateWebhookPayload(req.body);

      const callSid = req.body['CallSid'] as string;
      const status = req.body['CallStatus'] as string;

      const providerSession = this.twilioSessionManager.getSessionByCallSid(callSid);
      if (providerSession) {
        if (status === 'completed' || status === 'failed') {
          // End internal voice session
          await this.voiceSessionManager.endSession(
            providerSession.sessionId,
            providerSession.tenantId,
            status === 'failed' ? { code: 'CALL_FAILED', message: 'Twilio call callback reports failed.' } : undefined,
          );
          // Remove from local provider state
          this.twilioSessionManager.removeSession(providerSession.sessionId);
        }
      }

      res.status(200).send({ status: 'ok' });
    } catch (err) {
      if (err instanceof WebhookValidationFailure) {
        res.status(401).send(err.message);
        return;
      }
      next(err);
    }
  };
}

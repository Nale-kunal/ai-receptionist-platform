/**
 * Twilio Voice Provider — Webhook Controller and Routes Tests
 */

import express from 'express';
import type { Application } from 'express';
import request from 'supertest';
import { TwilioWebhookController } from '../twilio.webhook.controller';
import { createTwilioWebhookRoutes } from '../twilio.webhook.routes';
import { TwilioSecurityValidator } from '../twilio.security.validator';
import { TwilioVoiceSessionManager } from '../twilio.voice-session.manager';
import { TwilioAuditLogger } from '../twilio.audit.logger';
import { loadTwilioConfig } from '../twilio.config';
import type { IVoiceSessionManager } from '../../../interfaces/voice-server.interfaces';

// ---------------------------------------------------------------------------
// Mock Core Voice Session Manager
// ---------------------------------------------------------------------------

class MockVoiceSessionManager implements Partial<IVoiceSessionManager> {
  public sessions = new Map<string, any>();
  public lastCreatedSession: any = null;

  public async createSession(params: {
    tenantId: string;
    clinicId: string | null;
    provider: string;
    providerCallId: string;
    metadata?: Record<string, unknown>;
  }): Promise<any> {
    const session = {
      sessionId: `vses_${Math.random().toString(36).substr(2, 9)}`,
      ...params,
      connectionState: 'CREATED',
    };
    this.lastCreatedSession = session;
    this.sessions.set(session.sessionId, session);
    return session;
  }

  public async endSession(sessionId: string, tenantId: string, error?: any): Promise<any> {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.connectionState = 'ENDED';
      this.sessions.set(sessionId, session);
    }
    return session;
  }

  public rateLimitCheck(tenantId: string): boolean {
    return true; // Mock: rate limiting ok
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Twilio Webhook Controller HTTP Endpoints', () => {
  let app: Application;
  let mockVoiceSM: MockVoiceSessionManager;
  let twilioSM: TwilioVoiceSessionManager;
  let securityValidator: TwilioSecurityValidator;
  let controller: TwilioWebhookController;

  const authToken = 'test_secret_auth_token_value_456';
  const config = loadTwilioConfig({
    authToken,
    mediaStreamUrl: 'wss://localhost/voice/stream',
  });

  beforeEach(() => {
    mockVoiceSM = new MockVoiceSessionManager();
    twilioSM = new TwilioVoiceSessionManager();
    securityValidator = new TwilioSecurityValidator(authToken);
    controller = new TwilioWebhookController(
      config,
      securityValidator,
      mockVoiceSM as unknown as IVoiceSessionManager,
      twilioSM,
    );

    app = express();
    app.use(express.urlencoded({ extended: false }));
    app.use(express.json());
    app.use(createTwilioWebhookRoutes(controller));
  });

  it('rejects inbound webhook without signature header', async () => {
    const response = await request(app)
      .post('/webhooks/voice/inbound')
      .send({ CallSid: 'CA123', AccountSid: 'AC123' });

    expect(response.status).toBe(401);
  });

  it('passes inbound webhook signature and returns xml twiml stream response', async () => {
    const body = {
      CallSid: 'CA_test_call_sid_1',
      AccountSid: 'AC_test_account_sid_1',
      From: '+1234567890',
      To: '+1987654321',
      TenantId: 'tenant-abc-123',
    };

    // Calculate Twilio request signature
    const crypto = require('crypto');
    const url = 'http://127.0.0.1/webhooks/voice/inbound'; // Supertest default host is 127.0.0.1
    let dataStr = url;
    // Keys sorted alphabetically: AccountSid, CallSid, From, TenantId, To
    dataStr += 'AccountSidAC_test_account_sid_1';
    dataStr += 'CallSidCA_test_call_sid_1';
    dataStr += 'From+1234567890';
    dataStr += 'TenantIdtenant-abc-123';
    dataStr += 'To+1987654321';

    const signature = crypto
      .createHmac('sha1', authToken)
      .update(dataStr, 'utf-8')
      .digest('base64');

    const response = await request(app)
      .post('/webhooks/voice/inbound')
      .set('x-twilio-signature', signature)
      .send(body);

    expect(response.status).toBe(200);
    expect(response.type).toBe('text/xml');
    expect(response.text).toContain('<Stream url="wss://localhost/voice/stream">');
    expect(response.text).toContain('<Parameter name="sessionId"');
    
    // Sessions registered
    expect(twilioSM.activeCount()).toBe(1);
    const session = twilioSM.getSessionByCallSid('CA_test_call_sid_1');
    expect(session).toBeDefined();
    expect(session!.tenantId).toBe('tenant-abc-123');
  });
});

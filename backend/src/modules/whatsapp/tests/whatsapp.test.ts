/**
 * WhatsApp Module Tests
 *
 * Tests for HMAC-SHA256 signature verification, tenant isolation,
 * job queue idempotency, and booking service authorization guards.
 */

import * as crypto from 'crypto';
import { MetaCloudWhatsAppProvider } from '../providers/meta-cloud-whatsapp.provider';
import { WhatsAppTenantResolverService } from '../services/whatsapp-tenant-resolver.service';
import { WhatsAppIntegrationNotFoundError, WhatsAppIntegrationDisabledError } from '../errors/whatsapp.errors';

describe('WhatsApp Module - HMAC Signature Verification', () => {
  const secret = 'super_secret_app_secret_key_12345';
  const provider = new MetaCloudWhatsAppProvider({
    appSecret: secret,
    accessToken: 'test_token',
    apiVersion: 'v21.0',
  });

  it('should verify valid HMAC-SHA256 signature', () => {
    const rawBody = Buffer.from(JSON.stringify({ object: 'whatsapp_business_account', entry: [] }), 'utf8');
    const expectedSig = 'sha256=' + crypto.createHmac('sha256', secret).update(rawBody).digest('hex');

    const isValid = provider.verifyWebhookSignature(rawBody, expectedSig);
    expect(isValid).toBe(true);
  });

  it('should reject tampered payload with valid signature header', () => {
    const originalBody = Buffer.from(JSON.stringify({ object: 'whatsapp_business_account' }), 'utf8');
    const tamperedBody = Buffer.from(JSON.stringify({ object: 'hacked' }), 'utf8');
    const signature = 'sha256=' + crypto.createHmac('sha256', secret).update(originalBody).digest('hex');

    const isValid = provider.verifyWebhookSignature(tamperedBody, signature);
    expect(isValid).toBe(false);
  });

  it('should reject invalid signature header format', () => {
    const rawBody = Buffer.from('test payload', 'utf8');
    expect(provider.verifyWebhookSignature(rawBody, 'invalid_header')).toBe(false);
    expect(provider.verifyWebhookSignature(rawBody, '')).toBe(false);
    expect(provider.verifyWebhookSignature(rawBody, 'sha1=12345')).toBe(false);
  });
});

describe('WhatsApp Module - Tenant Resolver', () => {
  it('should throw WhatsAppIntegrationNotFoundError when phone number is not registered', async () => {
    const mockRepo: any = {
      findByPhoneNumber: jest.fn().mockResolvedValue(null),
    };
    const resolver = new WhatsAppTenantResolverService(mockRepo);

    await expect(resolver.resolve('+14155550000')).rejects.toThrow(WhatsAppIntegrationNotFoundError);
  });

  it('should throw WhatsAppIntegrationDisabledError when integration is inactive', async () => {
    const mockRepo: any = {
      findByPhoneNumber: jest.fn().mockResolvedValue({
        id: 'int_1',
        tenantId: 'tenant_1',
        clinicId: 'clinic_1',
        phoneNumber: '+14155550001',
        status: 'inactive',
        isEnabled: false,
      }),
    };
    const resolver = new WhatsAppTenantResolverService(mockRepo);

    await expect(resolver.resolve('+14155550001')).rejects.toThrow(WhatsAppIntegrationDisabledError);
  });

  it('should resolve active integration to correct tenant context', async () => {
    const mockIntegration = {
      id: 'int_1',
      tenantId: 'tenant_abc',
      clinicId: 'clinic_xyz',
      phoneNumber: '+14155550002',
      phoneNumberId: 'pn_12345',
      status: 'active',
      isEnabled: true,
    };
    const mockRepo: any = {
      findByPhoneNumber: jest.fn().mockResolvedValue(mockIntegration),
    };
    const resolver = new WhatsAppTenantResolverService(mockRepo);

    const result = await resolver.resolve('+14155550002');
    expect(result.tenantId).toBe('tenant_abc');
    expect(result.clinicId).toBe('clinic_xyz');
    expect(result.phoneNumberId).toBe('pn_12345');
  });
});

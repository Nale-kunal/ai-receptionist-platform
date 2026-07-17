/**
 * End-to-End Call Flow — Security Verification Tests
 */

import { validateIncomingCallPayload } from '../call.validators';
import { E2eSecurityValidationError } from '../end-to-end.errors';
import { CallAuditLogger } from '../call-audit.logger';

describe('E2E Call Security and Parameters Validation', () => {
  // ---------------------------------------------------------------------------
  // Payload validators
  // ---------------------------------------------------------------------------

  it('accepts valid incoming call payloads', () => {
    const payload = {
      tenantId: 'tenant-123',
      callerNumber: '+1234567890',
      calledNumber: '+1987654321',
      callSid: 'CA12345',
    };

    expect(() => validateIncomingCallPayload(payload)).not.toThrow();
  });

  it('rejects payloads missing tenantId or callSid', () => {
    const badPayload = {
      tenantId: '   ',
      callerNumber: '+123',
      calledNumber: '+456',
      callSid: 'CA123',
    };

    expect(() => validateIncomingCallPayload(badPayload)).toThrow(E2eSecurityValidationError);
  });

  it('rejects non-object call payloads', () => {
    expect(() => validateIncomingCallPayload(null)).toThrow(E2eSecurityValidationError);
    expect(() => validateIncomingCallPayload('string')).toThrow(E2eSecurityValidationError);
  });

  // ---------------------------------------------------------------------------
  // Logs sanitization & masking
  // ---------------------------------------------------------------------------

  it('masks parameters containing sensitive email or ssn fields', () => {
    const logger = new CallAuditLogger(() => {});
    
    // Test parameters masking
    const params = {
      ssn: '123-45-6789',
      patientName: 'John Doe',
      clinicId: 'abc-123',
    };

    const sanitized = (logger as any).sanitizeParameters(params);
    expect(sanitized.ssn).toBe('12****89');
    expect(sanitized.patientName).toBe('Jo****oe');
    expect(sanitized.clinicId).toBe('abc-123'); // Non-sensitive: unchanged
  });

  it('redacts tokens and keys in log text messages', () => {
    const logger = new CallAuditLogger(() => {});
    const msg = 'OAuth bearer eyJhbGciOiJIUzI1NiIsIn.eyJzdWIiOiIxMjM0NS.signature and OpenAI key sk-abcdefghijklmnopqrstuvwxyz1234567890abcdef';
    
    const sanitized = (logger as any).sanitizeMessage(msg);
    expect(sanitized).not.toContain('eyJhb');
    expect(sanitized).toContain('[JWT_REDACTED]');
    expect(sanitized).not.toContain('sk-abc');
    expect(sanitized).toContain('[API_KEY_REDACTED]');
  });
});

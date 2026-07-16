import { OrchestratorSecurityValidator } from '../middleware/orchestrator-security.validator';
import { ConversationOrchestratorError } from '../errors/conversation-orchestrator.errors';

describe('OrchestratorSecurityValidator', () => {
  let validator: OrchestratorSecurityValidator;

  beforeEach(() => {
    validator = new OrchestratorSecurityValidator({
      allowedOrigins: ['http://localhost:3000', 'https://receptionist.ai'],
    });
  });

  it('allows matching tenant contexts and blocks cross-tenant parameter requests', () => {
    expect(() => {
      validator.validateTenantContext('tenant-abc', 'tenant-abc');
    }).not.toThrow();

    expect(() => {
      validator.validateTenantContext('tenant-abc', 'tenant-xyz');
    }).toThrow(ConversationOrchestratorError);
  });

  it('verifies caller origin parameters against whitelist rules', () => {
    expect(() => {
      validator.validateOrigin('https://receptionist.ai');
    }).not.toThrow();

    expect(() => {
      validator.validateOrigin('https://malicious.com');
    }).toThrow(ConversationOrchestratorError);
  });

  it('redacts sensitive fields containing patient data', () => {
    const raw = {
      patientName: 'Kunal Nale',
      ssnCode: '123-45-678',
      clinicId: 'clinic-123',
    };

    const sanitized = validator.sanitizeLogs(raw);
    expect(sanitized.ssnCode).toBe('[REDACTED]');
    expect(sanitized.clinicId).toBe('clinic-123'); // remains unchanged
  });
});

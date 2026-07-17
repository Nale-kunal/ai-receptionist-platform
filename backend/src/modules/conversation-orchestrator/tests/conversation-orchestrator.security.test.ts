import { OrchestratorSecurityValidator } from '../conversation-orchestrator.security.validator';
import { ConversationOrchestratorError } from '../conversation-orchestrator.errors';

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

  it('verifies origin metadata against whitelist rules', () => {
    expect(() => {
      validator.validateOrigin('https://receptionist.ai');
    }).not.toThrow();

    expect(() => {
      validator.validateOrigin('https://malicious-domain.com');
    }).toThrow(ConversationOrchestratorError);
  });

  it('redacts sensitive credentials and authentication key values', () => {
    const raw = {
      patientName: 'Kunal Nale',
      ssnCode: '123-45-678',
      apiKey: 'sk-secret-key-12345',
    };

    const sanitized = validator.sanitizeLogs(raw);
    expect(sanitized.ssnCode).toBe('[REDACTED]');
    expect(sanitized.apiKey).toBe('[REDACTED]');
    expect(sanitized.patientName).toBe('Kunal Nale'); // unchanged
  });
});

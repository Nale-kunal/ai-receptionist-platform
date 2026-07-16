/**
 * Prompt Variable Resolver Service — Unit Tests
 */

import { PromptVariableResolverService } from '../services/prompt-variable-resolver.service';
import { PromptVariableError, PromptSecretLeakError } from '../errors/prompt-engine.errors';
import { MAX_PROMPT_CONTENT_LENGTH } from '../constants/prompt-engine.constants';

describe('PromptVariableResolverService', () => {
  let resolver: PromptVariableResolverService;

  beforeEach(() => {
    resolver = new PromptVariableResolverService();
  });

  // ---------------------------------------------------------------------------
  // resolve()
  // ---------------------------------------------------------------------------

  describe('resolve()', () => {
    it('resolves known variables correctly', () => {
      const template = 'Welcome to {{clinic_name}}. We are open in {{timezone}}.';
      const result = resolver.resolve(template, {
        clinic_name: 'Bright Smiles Dental',
        timezone: 'America/New_York',
      });
      expect(result).toBe('Welcome to Bright Smiles Dental. We are open in America/New_York.');
    });

    it('replaces missing (but allowed) variables with empty string', () => {
      const template = 'Phone: {{clinic_phone}}';
      const result = resolver.resolve(template, {});
      expect(result).toBe('Phone: ');
    });

    it('throws PromptVariableError for unknown variable', () => {
      const template = 'Hello {{unknown_var}} world';
      expect(() => resolver.resolve(template, {})).toThrow(PromptVariableError);
    });

    it('throws PromptSecretLeakError when content contains OpenAI key pattern', () => {
      const template = 'Key: sk-abcdefghijklmnopqrstuvwxyz123456789012345';
      expect(() => resolver.resolve(template, {})).toThrow(PromptSecretLeakError);
    });

    it('throws PromptSecretLeakError when content contains api_key pattern', () => {
      const template = 'api_key: supersecret123';
      expect(() => resolver.resolve(template, {})).toThrow(PromptSecretLeakError);
    });

    it('resolves multiple occurrences of the same variable', () => {
      const template = '{{clinic_name}} — {{clinic_name}}';
      const result = resolver.resolve(template, { clinic_name: 'Dental Care' });
      expect(result).toBe('Dental Care — Dental Care');
    });

    it('resolves all 15 whitelisted variables without throwing', () => {
      const template = [
        '{{clinic_name}} {{timezone}} {{language}} {{business_hours}} {{doctor_list}}',
        '{{clinic_phone}} {{clinic_address}} {{clinic_email}} {{clinic_website}} {{today}}',
        '{{current_time}} {{tenant_name}} {{appointment_duration}} {{greeting_message}} {{supported_languages}}',
      ].join(' ');

      const variables = {
        clinic_name: 'Dental', timezone: 'UTC', language: 'en',
        business_hours: '9-5', doctor_list: 'Dr. Smith',
        clinic_phone: '555-1234', clinic_address: '1 Main St',
        clinic_email: 'info@dental.com', clinic_website: 'dental.com',
        today: '2026-07-16', current_time: '10:00', tenant_name: 'Tenant A',
        appointment_duration: '30', greeting_message: 'Hello!',
        supported_languages: 'en',
      };
      expect(() => resolver.resolve(template, variables)).not.toThrow();
    });
  });

  // ---------------------------------------------------------------------------
  // validate()
  // ---------------------------------------------------------------------------

  describe('validate()', () => {
    it('returns valid: true for clean content with no variables', () => {
      const result = resolver.validate('Hello, how can I help you?', []);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('returns valid: true for content with known variables', () => {
      const result = resolver.validate('Welcome to {{clinic_name}}!', ['clinic_name']);
      expect(result.valid).toBe(true);
    });

    it('returns error for content exceeding max length', () => {
      const content = 'a'.repeat(MAX_PROMPT_CONTENT_LENGTH + 1);
      const result = resolver.validate(content, []);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === 'CONTENT_TOO_LARGE')).toBe(true);
    });

    it('returns error for empty {{}} variable', () => {
      const result = resolver.validate('Hello {{}} world', []);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === 'EMPTY_VARIABLE')).toBe(true);
    });

    it('returns error for unknown variable in content', () => {
      const result = resolver.validate('Hi {{unknown_var}}', []);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === 'UNKNOWN_VARIABLE')).toBe(true);
    });

    it('returns error for unknown declared variable', () => {
      const result = resolver.validate('No vars here', ['unknown_declared_var']);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === 'DECLARED_UNKNOWN_VARIABLE')).toBe(true);
    });

    it('returns error for secret-looking content', () => {
      const result = resolver.validate('sk-abcdefghijklmnopqrstuvwxyz123456789012345', []);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === 'SECRET_LEAK_DETECTED')).toBe(true);
    });

    it('accumulates multiple errors', () => {
      // Too long + unknown variable
      const content = '{{unknown_var}} ' + 'a'.repeat(MAX_PROMPT_CONTENT_LENGTH);
      const result = resolver.validate(content, []);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);
    });

    it('accepts content at exactly max length', () => {
      const content = 'a'.repeat(MAX_PROMPT_CONTENT_LENGTH);
      const result = resolver.validate(content, []);
      expect(result.valid).toBe(true);
    });
  });
});

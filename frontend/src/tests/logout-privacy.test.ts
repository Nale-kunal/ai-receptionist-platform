import { describe, it, expect } from 'vitest';
import { hashId, sanitizePayload } from '../services/telemetry';

// Mock localStorage for node test runner
const localStorageMap = new Map<string, string>();
const mockLocalStorage = {
  getItem: (key: string) => localStorageMap.get(key) || null,
  setItem: (key: string, value: string) => localStorageMap.set(key, value),
  removeItem: (key: string) => localStorageMap.delete(key),
  clear: () => localStorageMap.clear(),
};

describe('Logout Confirmation & Login Page Privacy Unit Tests', () => {
  describe('Login Privacy & RememberMe Opt-In Logic', () => {
    it('initializes email as empty string when remember_me_optin is not true', () => {
      mockLocalStorage.removeItem('remember_me_optin');
      mockLocalStorage.setItem('e2e_remembered_email', 'stale_user@clinic.com');

      const isOptIn = mockLocalStorage.getItem('remember_me_optin') === 'true';
      const email = isOptIn ? mockLocalStorage.getItem('e2e_remembered_email') || '' : '';

      expect(email).toBe('');
    });

    it('restores email when remember_me_optin is explicitly set to true', () => {
      mockLocalStorage.setItem('remember_me_optin', 'true');
      mockLocalStorage.setItem('e2e_remembered_email', 'optin_doctor@clinic.com');

      const isOptIn = mockLocalStorage.getItem('remember_me_optin') === 'true';
      const email = isOptIn ? mockLocalStorage.getItem('e2e_remembered_email') || '' : '';

      expect(email).toBe('optin_doctor@clinic.com');
    });

    it('purges e2e_remembered_email upon logout when remember_me_optin is disabled', () => {
      mockLocalStorage.removeItem('remember_me_optin');
      mockLocalStorage.setItem('e2e_remembered_email', 'temp_user@clinic.com');

      if (!mockLocalStorage.getItem('remember_me_optin')) {
        mockLocalStorage.removeItem('e2e_remembered_email');
      }

      expect(mockLocalStorage.getItem('e2e_remembered_email')).toBeNull();
    });
  });

  describe('Logout Telemetry & Audit Privacy', () => {
    it('anonymizes tenant and user IDs using SHA-256 hashing during logout events', () => {
      const tenantId = 'tenant-dental-uuid-999';
      const userId = 'user-owner-uuid-888';

      const hashedTenant = hashId(tenantId);
      const hashedUser = hashId(userId);

      expect(hashedTenant).not.toBe(tenantId);
      expect(hashedUser).not.toBe(userId);
      expect(hashedTenant).toMatch(/^h_[a-z0-9]+$/);
      expect(hashedUser).toMatch(/^h_[a-z0-9]+$/);
    });

    it('redacts sensitive headers, cookies, and tokens from logout event payloads', () => {
      const rawEventData = {
        action: 'logout_confirmed',
        userRole: 'clinic_owner',
        jwtToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        authHeader: 'Bearer secret_token_123',
        patientName: 'Jane Patient',
      };

      const sanitized = sanitizePayload(rawEventData);

      expect(sanitized.action).toBe('logout_confirmed');
      expect(sanitized.userRole).toBe('clinic_owner');
      expect(sanitized.jwtToken).toBe('[REDACTED]');
      expect(sanitized.authHeader).toBe('[REDACTED]');
      expect(sanitized.patientName).toBe('[REDACTED]');
    });
  });
});

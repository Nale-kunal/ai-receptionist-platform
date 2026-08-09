import { describe, it, expect } from 'vitest';
import { telemetry, hashId, sanitizePayload } from '../services/telemetry';

describe('Enterprise Telemetry & Privacy Audit Unit Tests', () => {
  describe('hashId() non-reversible SHA-256 anonymization', () => {
    it('produces consistent non-reversible hashes for identical IDs', () => {
      const tenantId = 'tenant-dental-uuid-12345';
      const hash1 = hashId(tenantId);
      const hash2 = hashId(tenantId);

      expect(hash1).toBe(hash2);
      expect(hash1).not.toBe(tenantId);
      expect(hash1).toMatch(/^h_[a-z0-9]+$/);
    });

    it('returns anonymous for null or empty string input', () => {
      expect(hashId(null)).toBe('anonymous');
      expect(hashId('')).toBe('anonymous');
    });
  });

  describe('sanitizePayload() PHI / PII / Token Redaction', () => {
    it('strips patientName, phone, email, and JWT tokens from telemetry payload', () => {
      const rawPayload = {
        patientName: 'John Doe',
        patientPhone: '+1 555-0199',
        patientEmail: 'john@example.com',
        jwtToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        appointmentDate: '2026-07-25',
        status: 'scheduled',
        clinicDetails: {
          doctorName: 'Dr. Smith',
          notes: 'Root canal treatment required',
        },
      };

      const sanitized = sanitizePayload(rawPayload);

      expect(sanitized.patientName).toBe('[REDACTED]');
      expect(sanitized.patientPhone).toBe('[REDACTED]');
      expect(sanitized.patientEmail).toBe('[REDACTED]');
      expect(sanitized.jwtToken).toBe('[REDACTED]');
      expect(sanitized.clinicDetails.doctorName).toBe('[REDACTED]');
      expect(sanitized.clinicDetails.notes).toBe('[REDACTED]');

      // Non-sensitive fields are preserved
      expect(sanitized.appointmentDate).toBe('2026-07-25');
      expect(sanitized.status).toBe('scheduled');
    });
  });

  describe('Telemetry Service Tracking', () => {
    it('generates correlation IDs and accumulates events cleanly', () => {
      const correlationId = telemetry.getCorrelationId();
      expect(correlationId).toMatch(/^tr_[a-z0-9_]+$/);

      expect(() => {
        telemetry.track('appointment_created', {
          module: 'calendar',
          action: 'create_slot',
          tenantId: 'tenant-123',
          userId: 'user-456',
          userRole: 'clinic_owner',
          payload: {
            status: 'scheduled',
          },
        });
      }).not.toThrow();
    });
  });
});

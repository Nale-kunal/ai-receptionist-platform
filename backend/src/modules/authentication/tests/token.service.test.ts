/**
 * TokenService Unit Tests
 *
 * Tests all cryptographic operations:
 *   - JWT signing and verification
 *   - Refresh token generation and hashing
 *   - Secure one-time token generation and hashing
 *   - Token pair building
 *   - Invalid secret handling
 *   - Expired token detection
 */

import { TokenService } from '../services/token.service';
import { InvalidAccessTokenError, MissingJwtSecretError } from '../errors/auth.errors';

// --------------------------------------------------------------------------
// Test Config
// --------------------------------------------------------------------------

const VALID_CONFIG = {
  jwtAccessSecret: 'super-secret-access-key-at-least-32-chars-long',
  jwtRefreshSecret: 'super-secret-refresh-key-at-least-32-chars',
};

const SAMPLE_PAYLOAD = {
  sub: 'user-uuid-123',
  tenantId: 'tenant-uuid-456',
  clinicId: 'clinic-uuid-789',
  role: 'clinic_owner',
  tokenVersion: 0,
  sessionId: 'session-uuid-abc',
  email: 'test@example.com',
};

// --------------------------------------------------------------------------
// Tests
// --------------------------------------------------------------------------

describe('TokenService', () => {
  let tokenService: TokenService;

  beforeEach(() => {
    tokenService = new TokenService(VALID_CONFIG);
  });

  // ----------------------------------------------------------------
  // Constructor Validation
  // ----------------------------------------------------------------

  describe('constructor', () => {
    it('should throw MissingJwtSecretError when access secret is missing', () => {
      expect(
        () => new TokenService({ ...VALID_CONFIG, jwtAccessSecret: '' }),
      ).toThrow(MissingJwtSecretError);
    });

    it('should throw MissingJwtSecretError when access secret is too short', () => {
      expect(
        () => new TokenService({ ...VALID_CONFIG, jwtAccessSecret: 'short' }),
      ).toThrow(MissingJwtSecretError);
    });

    it('should throw MissingJwtSecretError when refresh secret is missing', () => {
      expect(
        () => new TokenService({ ...VALID_CONFIG, jwtRefreshSecret: '' }),
      ).toThrow(MissingJwtSecretError);
    });

    it('should instantiate successfully with valid config', () => {
      expect(() => new TokenService(VALID_CONFIG)).not.toThrow();
    });
  });

  // ----------------------------------------------------------------
  // Access Token Signing & Verification
  // ----------------------------------------------------------------

  describe('signAccessToken / verifyAccessToken', () => {
    it('should sign and verify a valid access token', () => {
      const token = tokenService.signAccessToken(SAMPLE_PAYLOAD);
      expect(typeof token).toBe('string');
      expect(token.split('.').length).toBe(3); // JWT format: header.payload.signature

      const verified = tokenService.verifyAccessToken(token);
      expect(verified.sub).toBe(SAMPLE_PAYLOAD.sub);
      expect(verified.tenantId).toBe(SAMPLE_PAYLOAD.tenantId);
      expect(verified.sessionId).toBe(SAMPLE_PAYLOAD.sessionId);
      expect(verified.role).toBe(SAMPLE_PAYLOAD.role);
      expect(verified.tokenVersion).toBe(SAMPLE_PAYLOAD.tokenVersion);
    });

    it('should throw InvalidAccessTokenError for a tampered token', () => {
      const token = tokenService.signAccessToken(SAMPLE_PAYLOAD);
      const tampered = token.slice(0, -5) + 'XXXXX';
      expect(() => tokenService.verifyAccessToken(tampered)).toThrow(InvalidAccessTokenError);
    });

    it('should throw InvalidAccessTokenError for a token signed with wrong secret', () => {
      const otherService = new TokenService({
        ...VALID_CONFIG,
        jwtAccessSecret: 'completely-different-secret-that-is-32-chars-long!',
      });
      const token = otherService.signAccessToken(SAMPLE_PAYLOAD);
      expect(() => tokenService.verifyAccessToken(token)).toThrow(InvalidAccessTokenError);
    });

    it('should throw InvalidAccessTokenError for an expired token', async () => {
      const shortLived = new TokenService({
        ...VALID_CONFIG,
        accessTokenTtlSeconds: 1,
      });
      const token = shortLived.signAccessToken(SAMPLE_PAYLOAD);
      await new Promise((r) => setTimeout(r, 1100)); // Wait for expiry
      expect(() => shortLived.verifyAccessToken(token)).toThrow(InvalidAccessTokenError);
    }, 10_000);

    it('should not include iat/exp in the payload before signing to avoid conflicts', () => {
      const payloadWithExp = { ...SAMPLE_PAYLOAD, exp: 9999999999, iat: 1111111111 };
      const token = tokenService.signAccessToken(payloadWithExp);
      const decoded = tokenService.verifyAccessToken(token);
      // The library should set exp to now + ttl, not the passed exp
      expect(decoded.exp).toBeLessThan(9999999999);
    });
  });

  // ----------------------------------------------------------------
  // Refresh Token
  // ----------------------------------------------------------------

  describe('generateRefreshToken / hashRefreshToken', () => {
    it('should generate a non-empty URL-safe base64 string', () => {
      const token = tokenService.generateRefreshToken();
      expect(typeof token).toBe('string');
      expect(token.length).toBeGreaterThan(0);
      // URL-safe base64: only alphanumeric, -, _
      expect(/^[A-Za-z0-9\-_]+$/.test(token)).toBe(true);
    });

    it('should generate unique tokens on each call', () => {
      const tokens = new Set(Array.from({ length: 100 }, () => tokenService.generateRefreshToken()));
      expect(tokens.size).toBe(100);
    });

    it('should produce a consistent SHA-256 hex hash for the same input', () => {
      const raw = tokenService.generateRefreshToken();
      const hash1 = tokenService.hashRefreshToken(raw);
      const hash2 = tokenService.hashRefreshToken(raw);
      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64); // SHA-256 hex = 64 chars
    });

    it('should produce different hashes for different tokens', () => {
      const raw1 = tokenService.generateRefreshToken();
      const raw2 = tokenService.generateRefreshToken();
      expect(tokenService.hashRefreshToken(raw1)).not.toBe(tokenService.hashRefreshToken(raw2));
    });
  });

  // ----------------------------------------------------------------
  // Secure One-Time Token
  // ----------------------------------------------------------------

  describe('generateSecureToken / hashSecureToken', () => {
    it('should generate unique cryptographic tokens', () => {
      const tokens = new Set(Array.from({ length: 50 }, () => tokenService.generateSecureToken()));
      expect(tokens.size).toBe(50);
    });

    it('should produce a 64-char SHA-256 hex hash', () => {
      const raw = tokenService.generateSecureToken();
      const hash = tokenService.hashSecureToken(raw);
      expect(hash).toHaveLength(64);
    });
  });

  // ----------------------------------------------------------------
  // Token Pair Builder
  // ----------------------------------------------------------------

  describe('buildTokenPair', () => {
    it('should return a complete token pair with expiry dates', () => {
      const pair = tokenService.buildTokenPair(SAMPLE_PAYLOAD);
      expect(pair.accessToken).toBeDefined();
      expect(pair.refreshToken).toBeDefined();
      expect(pair.accessTokenExpiresAt).toBeInstanceOf(Date);
      expect(pair.refreshTokenExpiresAt).toBeInstanceOf(Date);
      expect(pair.refreshTokenExpiresAt.getTime()).toBeGreaterThan(pair.accessTokenExpiresAt.getTime());
    });
  });
});

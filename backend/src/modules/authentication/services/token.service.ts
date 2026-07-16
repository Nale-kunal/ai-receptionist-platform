/**
 * Token Service
 *
 * Owns all cryptographic token operations:
 *   - JWT access token signing and verification
 *   - Opaque refresh token generation and hashing
 *   - One-time secure token generation and hashing (password reset, email verification)
 *
 * SECURITY RULES enforced here:
 *   - JWT secret is read from config layer, never from process.env directly
 *   - Refresh tokens are opaque random bytes (not JWTs)
 *   - Hashing uses SHA-256 (sufficient for random tokens; not for passwords)
 *   - Never logs token values
 *
 * Per the Authentication Contract:
 *   - Access token TTL: 15 minutes
 *   - Refresh token TTL: 30 days
 *   - Token rotation: required on every refresh
 */

import * as crypto from 'crypto';
import * as jwt from 'jsonwebtoken';

import {
  ACCESS_TOKEN_TTL_SECONDS,
  REFRESH_TOKEN_TTL_SECONDS,
  SECURE_TOKEN_BYTES,
  JWT_ALGORITHM,
} from '../constants/auth.constants';

import {
  InvalidAccessTokenError,
  MissingJwtSecretError,
} from '../errors/auth.errors';

import type { ITokenService } from '../interfaces/auth.interfaces';
import type { AccessTokenPayload, VerifiedAccessToken } from '../interfaces/token.interfaces';
import type { TokenPair } from '../types/auth.types';

// --------------------------------------------------------------------------
// Config Shape (injected — never read process.env directly)
// --------------------------------------------------------------------------

export interface TokenServiceConfig {
  jwtAccessSecret: string;
  jwtRefreshSecret: string;
  accessTokenTtlSeconds?: number;
  refreshTokenTtlSeconds?: number;
}

// --------------------------------------------------------------------------
// Token Service
// --------------------------------------------------------------------------

export class TokenService implements ITokenService {
  private readonly accessSecret: string;
  private readonly refreshSecret: string;
  private readonly accessTtl: number;
  private readonly refreshTtl: number;

  constructor(config: TokenServiceConfig) {
    if (!config.jwtAccessSecret || config.jwtAccessSecret.length < 32) {
      throw new MissingJwtSecretError('JWT_ACCESS_SECRET');
    }
    if (!config.jwtRefreshSecret || config.jwtRefreshSecret.length < 32) {
      throw new MissingJwtSecretError('JWT_REFRESH_SECRET');
    }

    this.accessSecret = config.jwtAccessSecret;
    this.refreshSecret = config.jwtRefreshSecret;
    this.accessTtl = config.accessTokenTtlSeconds ?? ACCESS_TOKEN_TTL_SECONDS;
    this.refreshTtl = config.refreshTokenTtlSeconds ?? REFRESH_TOKEN_TTL_SECONDS;
  }

  // --------------------------------------------------------------------------
  // Access Token
  // --------------------------------------------------------------------------

  signAccessToken(payload: AccessTokenPayload): string {
    const { iat: _iat, exp: _exp, ...cleanPayload } = payload;
    return jwt.sign(cleanPayload, this.accessSecret, {
      algorithm: JWT_ALGORITHM,
      expiresIn: this.accessTtl,
    });
  }

  verifyAccessToken(token: string): VerifiedAccessToken {
    try {
      const decoded = jwt.verify(token, this.accessSecret, {
        algorithms: [JWT_ALGORITHM],
      }) as VerifiedAccessToken;
      return decoded;
    } catch (error) {
      throw new InvalidAccessTokenError();
    }
  }

  // --------------------------------------------------------------------------
  // Refresh Token
  // --------------------------------------------------------------------------

  /**
   * Generates a cryptographically random opaque refresh token.
   * This is NOT a JWT — it is a random URL-safe base64 string.
   * The raw token is delivered to the client via HttpOnly cookie.
   * Only its SHA-256 hash is stored in the database.
   */
  generateRefreshToken(): string {
    return crypto.randomBytes(SECURE_TOKEN_BYTES).toString('base64url');
  }

  hashRefreshToken(rawToken: string): string {
    return crypto.createHash('sha256').update(rawToken).digest('hex');
  }

  // --------------------------------------------------------------------------
  // One-time Secure Token (password reset, email verification)
  // --------------------------------------------------------------------------

  /**
   * Generates a cryptographically random one-time token.
   * URL-safe, suitable for email links.
   * The raw token is emailed; only the hash is stored.
   */
  generateSecureToken(): string {
    return crypto.randomBytes(SECURE_TOKEN_BYTES).toString('base64url');
  }

  hashSecureToken(rawToken: string): string {
    return crypto.createHash('sha256').update(rawToken).digest('hex');
  }

  // --------------------------------------------------------------------------
  // Token Pair Builder
  // --------------------------------------------------------------------------

  buildTokenPair(payload: AccessTokenPayload): TokenPair {
    const now = new Date();
    const accessToken = this.signAccessToken(payload);
    const refreshToken = this.generateRefreshToken();

    return {
      accessToken,
      refreshToken,
      accessTokenExpiresAt: new Date(now.getTime() + this.accessTtl * 1000),
      refreshTokenExpiresAt: new Date(now.getTime() + this.refreshTtl * 1000),
    };
  }

  // --------------------------------------------------------------------------
  // Helpers
  // --------------------------------------------------------------------------

  getRefreshTokenTtlSeconds(): number {
    return this.refreshTtl;
  }

  getAccessTokenTtlSeconds(): number {
    return this.accessTtl;
  }
}

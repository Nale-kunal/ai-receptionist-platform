/**
 * Admin Token Service
 *
 * Issues and verifies JWTs for the Platform Super Admin auth boundary.
 * Uses ADMIN_JWT_ACCESS_SECRET and ADMIN_JWT_REFRESH_SECRET — completely
 * separate from the clinic backend JWT secrets.
 *
 * JWT payload contains ONLY:
 *   - adminId   (UUID)
 *   - sessionId (UUID)
 *   - tokenVersion (number — for revocation)
 *
 * No email, role, or other PII is embedded in the token.
 */

import * as jwt from 'jsonwebtoken';
import * as crypto from 'crypto';

export interface AdminAccessTokenPayload {
  adminId: string;
  sessionId: string;
  tokenVersion: number;
  type: 'admin_access';
}

export interface AdminRefreshTokenPayload {
  adminId: string;
  sessionId: string;
  tokenVersion: number;
  type: 'admin_refresh';
}

export class AdminTokenService {
  private readonly accessSecret: string;
  private readonly refreshSecret: string;

  constructor(accessSecret: string, refreshSecret: string) {
    this.accessSecret = accessSecret;
    this.refreshSecret = refreshSecret;
  }

  /** Issue a short-lived access token (15 minutes) */
  issueAccessToken(payload: Omit<AdminAccessTokenPayload, 'type'>): string {
    return jwt.sign(
      { ...payload, type: 'admin_access' } satisfies AdminAccessTokenPayload,
      this.accessSecret,
      { expiresIn: '15m', algorithm: 'HS256' }
    );
  }

  /** Verify an access token and return its payload */
  verifyAccessToken(token: string): AdminAccessTokenPayload {
    const decoded = jwt.verify(token, this.accessSecret, { algorithms: ['HS256'] });
    if (typeof decoded !== 'object' || (decoded as any).type !== 'admin_access') {
      throw new Error('Invalid admin access token');
    }
    return decoded as AdminAccessTokenPayload;
  }

  /** Issue a long-lived refresh token (7 days) — returned as opaque string */
  issueRefreshToken(payload: Omit<AdminRefreshTokenPayload, 'type'>): string {
    return jwt.sign(
      { ...payload, type: 'admin_refresh' } satisfies AdminRefreshTokenPayload,
      this.refreshSecret,
      { expiresIn: '7d', algorithm: 'HS256' }
    );
  }

  /** Verify a refresh token */
  verifyRefreshToken(token: string): AdminRefreshTokenPayload {
    const decoded = jwt.verify(token, this.refreshSecret, { algorithms: ['HS256'] });
    if (typeof decoded !== 'object' || (decoded as any).type !== 'admin_refresh') {
      throw new Error('Invalid admin refresh token');
    }
    return decoded as AdminRefreshTokenPayload;
  }

  /** Hash a refresh token for safe storage (SHA-256) */
  hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }
}

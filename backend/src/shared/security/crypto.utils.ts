/**
 * Shared Cryptographic Utilities
 *
 * Provides standard, secure Node.js crypto helpers across the application.
 */

import * as crypto from 'crypto';

export const cryptoUtils = {
  /**
   * Generates a cryptographically random RFC 4122 v4 UUID.
   */
  generateUUID(): string {
    return crypto.randomUUID();
  },

  /**
   * Generates a cryptographically random hex string of given byte length.
   */
  generateRandomString(bytes = 32): string {
    return crypto.randomBytes(bytes).toString('hex');
  },

  /**
   * Computes a SHA-256 hash of a string input.
   */
  sha256(input: string): string {
    return crypto.createHash('sha256').update(input).digest('hex');
  },
};

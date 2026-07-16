/**
 * Calendar OAuth Credentials Encryption Utilities
 *
 * Enforces AES-256-CBC token encryption per Calendar Contract §OAuth Credentials.
 */

import * as crypto from 'crypto';
import { CalendarEncryptionKeyError } from '../errors/calendar.errors';

export function encryptToken(text: string, secretKey: string): string {
  if (!secretKey || secretKey.length < 16) {
    throw new CalendarEncryptionKeyError();
  }

  // Derive a 32-byte key from the secretKey
  const key = crypto.createHash('sha256').update(secretKey).digest();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);

  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  return `${iv.toString('hex')}:${encrypted}`;
}

export function decryptToken(encryptedText: string, secretKey: string): string {
  if (!secretKey || secretKey.length < 16) {
    throw new CalendarEncryptionKeyError();
  }

  const parts = encryptedText.split(':');
  if (parts.length !== 2) {
    throw new Error('Invalid encrypted token format');
  }

  const iv = Buffer.from(parts[0], 'hex');
  const encrypted = parts[1];
  const key = crypto.createHash('sha256').update(secretKey).digest();
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

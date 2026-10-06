/**
 * Canonical Email Normalization Utility
 *
 * Ensures consistent email identity across user creation, login,
 * invitation creation, duplicate detection, and acceptance.
 */
export function normalizeEmail(email: string): string {
  if (!email || typeof email !== 'string') return '';
  return email.trim().toLowerCase();
}

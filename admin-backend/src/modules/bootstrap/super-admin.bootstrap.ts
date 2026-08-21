/**
 * Super Admin Bootstrap
 *
 * Idempotent: reads SUPER_ADMIN_INITIAL_EMAIL and SUPER_ADMIN_INITIAL_PASSWORD
 * from environment variables ONLY. Creates the first super admin account if
 * one does not already exist. Never overwrites an existing account.
 *
 * SECURITY:
 *   - Passwords hashed with argon2id before storage
 *   - mustChangePassword=true is set on bootstrap (forces change on first login)
 *   - No credentials are logged, even in debug/development mode
 *   - This function is safe to call on every boot (idempotent)
 */

import * as argon2 from 'argon2';
import { prisma } from '../../shared/prisma';

const ARGON2_OPTIONS: argon2.Options & { raw?: false } = {
  type: argon2.argon2id,
  memoryCost: 65536,  // 64 MB
  timeCost: 3,
  parallelism: 1,
};

export async function bootstrapSuperAdmin(): Promise<void> {
  const email = process.env['SUPER_ADMIN_INITIAL_EMAIL'];
  const password = process.env['SUPER_ADMIN_INITIAL_PASSWORD'];
  const displayName = process.env['SUPER_ADMIN_INITIAL_DISPLAY_NAME'] ?? 'Platform Admin';

  if (!email || !password) {
    console.log('[admin-bootstrap] SUPER_ADMIN_INITIAL_EMAIL or SUPER_ADMIN_INITIAL_PASSWORD not set — skipping bootstrap.');
    return;
  }

  // Check if any super admin already exists
  const existing = await prisma.superAdmin.findUnique({
    where: { email },
    select: { id: true, email: true },
  });

  if (existing) {
    console.log(`[admin-bootstrap] Super admin already exists (${existing.email}) — skipping bootstrap.`);
    return;
  }

  // Hash password with argon2id
  const passwordHash = await argon2.hash(password, ARGON2_OPTIONS);

  // Create the super admin account
  const admin = await prisma.superAdmin.create({
    data: {
      email,
      passwordHash,
      displayName,
      isActive: true,
      mustChangePassword: true, // Force change on first login
      failedLoginAttempts: 0,
      tokenVersion: 0,
    },
    select: { id: true, email: true, displayName: true },
  });

  // Emit audit log for the bootstrap event
  await prisma.adminAuditLog.create({
    data: {
      adminId: null, // System-generated — no admin actor
      action: 'superadmin.bootstrap',
      entityType: 'SuperAdmin',
      entityId: admin.id,
      outcome: 'success',
      metadata: { email: admin.email, displayName: admin.displayName },
    },
  });

  console.log(`[admin-bootstrap] ✅ Super admin created: ${admin.email}`);
  console.log(`[admin-bootstrap] ⚠️  Password change will be required on first login.`);
}

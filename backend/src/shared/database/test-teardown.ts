/**
 * Test Teardown Utilities
 *
 * Provides safe, isolated, and relationship-aware teardown functions for
 * automated test suites to prevent test fixtures from leaking into the database.
 */

import { PrismaClient } from '@prisma/client';

const GENUINE_TENANT_ID = 'bb3b7ffc-a463-4d0f-8dc0-1f8d30de5cb0';

export async function cleanupTestTenant(
  tenantId: string | undefined | null,
  prisma: PrismaClient
): Promise<void> {
  if (!tenantId) return;

  // SAFETY GUARD: NEVER delete or touch the genuine application tenant
  if (tenantId === GENUINE_TENANT_ID) {
    console.warn(`[TestTeardown] Refusing to delete genuine tenant: ${tenantId}`);
    return;
  }

  try {
    const testUsers = await prisma.user.findMany({
      where: { tenantId },
      select: { id: true, email: true },
    });
    const testUserIds = testUsers.map((u) => u.id);
    const testUserEmails = testUsers.map((u) => u.email);

    await prisma.$transaction(async (tx) => {
      // 1. Delete notifications
      await tx.notification.deleteMany({ where: { tenantId } });

      // 2. Delete auth tokens
      if (testUserIds.length > 0) {
        await tx.emailVerificationToken.deleteMany({ where: { userId: { in: testUserIds } } });
        await tx.passwordResetToken.deleteMany({ where: { userId: { in: testUserIds } } });
        await tx.session.deleteMany({ where: { userId: { in: testUserIds } } });
      }

      // 3. Delete user roles
      await tx.userRole.deleteMany({ where: { tenantId } });

      // 4. Delete custom roles
      const roles = await tx.role.findMany({ where: { tenantId }, select: { id: true } });
      const roleIds = roles.map((r) => r.id);
      if (roleIds.length > 0) {
        await tx.rolePermission.deleteMany({ where: { roleId: { in: roleIds } } });
        await tx.role.deleteMany({ where: { id: { in: roleIds } } });
      }

      // 5. Delete audit logs, configurations, invitations
      await tx.rbacAuditLog.deleteMany({ where: { tenantId } });
      await tx.configuration.deleteMany({ where: { tenantId } });
      await tx.invitation.deleteMany({ where: { tenantId } });

      // 6. Delete domain models
      await tx.appointment.deleteMany({ where: { tenantId } });
      await tx.patient.deleteMany({ where: { tenantId } });
      await tx.doctor.deleteMany({ where: { tenantId } });
      await tx.clinic.deleteMany({ where: { tenantId } });

      // 7. Delete users
      if (testUserIds.length > 0) {
        await tx.user.deleteMany({ where: { id: { in: testUserIds } } });
      }

      // 8. Delete mail jobs
      await tx.mailJob.deleteMany({
        where: {
          OR: [
            { tenantId },
            ...(testUserEmails.length > 0 ? [{ recipient: { in: testUserEmails } }] : []),
          ],
        },
      });

      // 9. Delete tenant
      await tx.tenant.deleteMany({ where: { id: tenantId } });
    }, {
      timeout: 30000,
      maxWait: 10000,
    });
  } catch (err) {
    // Non-fatal logging for teardown
    console.warn(`[TestTeardown] Warning during teardown of tenant ${tenantId}:`, (err as Error).message);
  }
}

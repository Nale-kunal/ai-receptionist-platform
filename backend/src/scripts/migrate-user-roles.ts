/**
 * RBAC Migration Script — Populate user_roles for existing accounts
 *
 * Usage:
 *   npx ts-node src/scripts/migrate-user-roles.ts
 */

import { PrismaClient } from '@prisma/client';
import { RoleRepository } from '../modules/rbac/repositories/role.repository';
import { PermissionRepository } from '../modules/rbac/repositories/permission.repository';
import { UserRoleRepository } from '../modules/rbac/repositories/user-role.repository';
import { PermissionCacheService } from '../modules/rbac/services/permission-cache.service';
import { RbacBootstrapService } from '../modules/rbac/services/rbac-bootstrap.service';

export async function migrateExistingUserRoles(prismaClient?: PrismaClient): Promise<{ migratedCount: number }> {
  const prisma = prismaClient ?? new PrismaClient();
  const roleRepo = new RoleRepository(prisma);
  const permRepo = new PermissionRepository(prisma);
  const userRoleRepo = new UserRoleRepository(prisma);
  const cache = new PermissionCacheService();

  const rbacBootstrap = new RbacBootstrapService(
    prisma,
    roleRepo,
    permRepo,
    userRoleRepo,
    cache
  );

  console.log('[RBAC Migration] Seeding system permissions and roles...');
  await rbacBootstrap.ensureSystemRolesAndPermissions(null);

  const users = await prisma.user.findMany({
    where: { deletedAt: null },
  });

  console.log(`[RBAC Migration] Found ${users.length} user accounts to process.`);
  let count = 0;

  for (const user of users) {
    const roleName = user.role || 'clinic_owner';
    await rbacBootstrap.assignSystemRoleToUser({
      userId: user.id,
      tenantId: user.tenantId,
      roleName,
      clinicId: user.clinicId,
    });
    count++;
  }

  console.log(`[RBAC Migration] Successfully populated user_roles for ${count} users.`);

  if (!prismaClient) {
    await prisma.$disconnect();
  }

  return { migratedCount: count };
}

if (require.main === module) {
  migrateExistingUserRoles()
    .then(({ migratedCount }) => {
      console.log(`[RBAC Migration] Complete! Total users migrated: ${migratedCount}`);
      process.exit(0);
    })
    .catch((err) => {
      console.error('[RBAC Migration Error]:', err);
      process.exit(1);
    });
}

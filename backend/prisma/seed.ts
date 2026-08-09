import { PrismaClient } from '@prisma/client';
import { RoleRepository } from '../src/modules/rbac/repositories/role.repository';
import { PermissionRepository } from '../src/modules/rbac/repositories/permission.repository';
import { UserRoleRepository } from '../src/modules/rbac/repositories/user-role.repository';
import { PermissionCacheService } from '../src/modules/rbac/services/permission-cache.service';
import { RbacBootstrapService } from '../src/modules/rbac/services/rbac-bootstrap.service';

const prisma = new PrismaClient();

async function main() {
  console.log('[Prisma Seed] Initializing system roles and permissions...');

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

  // 1. Seed System Roles & Permissions globally
  const roleMap = await rbacBootstrap.ensureSystemRolesAndPermissions(null);
  console.log('[Prisma Seed] System RBAC seeded globally. Roles created:', Object.keys(roleMap));

  // 2. Seed System Roles for each tenant
  const tenants = await prisma.tenant.findMany({ where: { deletedAt: null } });
  for (const tenant of tenants) {
    await rbacBootstrap.ensureSystemRolesAndPermissions(tenant.id);
  }
  console.log(`[Prisma Seed] System RBAC seeded for ${tenants.length} tenants.`);

  // 3. Populate user_roles join table for all existing users
  const users = await prisma.user.findMany({ where: { deletedAt: null } });
  let assignedCount = 0;
  for (const user of users) {
    await rbacBootstrap.assignSystemRoleToUser({
      userId: user.id,
      tenantId: user.tenantId,
      roleName: user.role ?? 'clinic_owner',
      clinicId: user.clinicId,
    });
    assignedCount++;
  }
  console.log(`[Prisma Seed] Assigned system roles in user_roles table for ${assignedCount} users.`);
}

main()
  .catch((e) => {
    console.error('[Prisma Seed Error]:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

/**
 * RBAC Routes
 *
 * All RBAC management endpoints.
 * Authentication middleware (authenticate) must run before these routes.
 * Authorization middleware is injected — not hard-coded.
 *
 * Route structure:
 *   GET    /api/v1/rbac/roles                            — list roles
 *   POST   /api/v1/rbac/roles                            — create role
 *   GET    /api/v1/rbac/roles/:id                        — get role
 *   PATCH  /api/v1/rbac/roles/:id                        — update role
 *   DELETE /api/v1/rbac/roles/:id                        — delete role
 *   POST   /api/v1/rbac/roles/:id/permissions            — grant permission to role
 *   DELETE /api/v1/rbac/roles/:id/permissions/:permissionId — revoke permission from role
 *
 *   GET    /api/v1/rbac/permissions                      — list permissions
 *   POST   /api/v1/rbac/permissions                      — create permission
 *   GET    /api/v1/rbac/permissions/:id                  — get permission
 *   PATCH  /api/v1/rbac/permissions/:id                  — update permission
 *   DELETE /api/v1/rbac/permissions/:id                  — delete permission
 *
 *   GET    /api/v1/rbac/users/:userId/roles              — get user's roles
 *   POST   /api/v1/rbac/users/roles                      — assign role to user
 *   DELETE /api/v1/rbac/users/:userId/roles/:roleId      — revoke role from user
 */

import { Router, type RequestHandler } from 'express';
import type { RbacController } from '../controllers/rbac.controller';
import type { AuthorizeMiddleware } from '../middleware/authorize.middleware';
import {
  PERM_RBAC_ROLE_MANAGE,
  PERM_RBAC_PERMISSION_MANAGE,
  PERM_USER_READ,
} from '../constants/rbac.constants';

export interface RbacRouterDeps {
  controller: RbacController;
  authorize: AuthorizeMiddleware;
  /** The authentication middleware — must run before any RBAC endpoint */
  authenticate: RequestHandler;
}

export function createRbacRouter(deps: RbacRouterDeps): Router {
  const { controller, authorize, authenticate } = deps;

  const requireRoleManage = authorize.requirePermission(PERM_RBAC_ROLE_MANAGE);
  const requirePermissionManage = authorize.requirePermission(PERM_RBAC_PERMISSION_MANAGE);
  const requireUserRead = authorize.requirePermission(PERM_USER_READ);

  const router = Router();

  // ============================================================
  // Roles
  // ============================================================

  router.get('/roles',
    authenticate,
    requireRoleManage,
    controller.listRoles,
  );

  router.post('/roles',
    authenticate,
    requireRoleManage,
    controller.createRole,
  );

  router.get('/roles/:id',
    authenticate,
    requireRoleManage,
    controller.getRole,
  );

  router.patch('/roles/:id',
    authenticate,
    requireRoleManage,
    controller.updateRole,
  );

  router.delete('/roles/:id',
    authenticate,
    requireRoleManage,
    controller.deleteRole,
  );

  // Role ↔ Permission
  router.post('/roles/:id/permissions',
    authenticate,
    requireRoleManage,
    controller.grantPermissionToRole,
  );

  router.delete('/roles/:id/permissions/:permissionId',
    authenticate,
    requireRoleManage,
    controller.revokePermissionFromRole,
  );

  // ============================================================
  // Permissions
  // ============================================================

  router.get('/permissions',
    authenticate,
    requirePermissionManage,
    controller.listPermissions,
  );

  router.post('/permissions',
    authenticate,
    requirePermissionManage,
    controller.createPermission,
  );

  router.get('/permissions/:id',
    authenticate,
    requirePermissionManage,
    controller.getPermission,
  );

  router.patch('/permissions/:id',
    authenticate,
    requirePermissionManage,
    controller.updatePermission,
  );

  router.delete('/permissions/:id',
    authenticate,
    requirePermissionManage,
    controller.deletePermission,
  );

  // ============================================================
  // User ↔ Role assignment
  // ============================================================

  router.get('/users/:userId/roles',
    authenticate,
    requireUserRead,
    controller.getUserRoles,
  );

  router.post('/users/roles',
    authenticate,
    requireRoleManage,
    controller.assignRoleToUser,
  );

  router.delete('/users/:userId/roles/:roleId',
    authenticate,
    requireRoleManage,
    controller.revokeRoleFromUser,
  );

  return router;
}

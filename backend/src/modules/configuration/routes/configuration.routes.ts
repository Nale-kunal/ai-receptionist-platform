/**
 * Configuration Routes
 *
 * Exposes REST endpoints for viewing and editing tenant-specific configuration.
 * Protects paths using Authentication, Tenant resolution, and RBAC permission checks.
 */

import { Router } from 'express';
import type { RequestHandler } from 'express';
import type { ConfigurationController } from '../controllers/configuration.controller';
import {
  PERM_CLINIC_SETTINGS_READ,
  PERM_CLINIC_SETTINGS_UPDATE,
} from '../../rbac/constants/rbac.constants';

export interface AuthorizeMiddleware {
  requirePermission(permission: string): RequestHandler;
}

export interface ConfigurationRouterDeps {
  controller: ConfigurationController;
  authenticate: RequestHandler;
  resolveTenant: RequestHandler;
  authorize: AuthorizeMiddleware;
}

export function createConfigurationRouter(deps: ConfigurationRouterDeps): Router {
  const { controller, authenticate, resolveTenant, authorize } = deps;
  const router = Router();

  const requireSettingsRead = authorize.requirePermission(PERM_CLINIC_SETTINGS_READ);
  const requireSettingsUpdate = authorize.requirePermission(PERM_CLINIC_SETTINGS_UPDATE);

  // 1. Get active configuration (reads cache/db with tenant-clinic inheritance)
  router.get('/',
    authenticate,
    resolveTenant,
    requireSettingsRead,
    controller.getActiveConfiguration,
  );

  // 2. Get history (list all versions for tenant-clinic combination)
  router.get('/history',
    authenticate,
    resolveTenant,
    requireSettingsRead,
    controller.listConfigurationHistory,
  );

  // 3. Get specific configuration version details by ID
  router.get('/:id',
    authenticate,
    resolveTenant,
    requireSettingsRead,
    controller.getConfigurationById,
  );

  // 4. Create new configuration version
  router.post('/',
    authenticate,
    resolveTenant,
    requireSettingsUpdate,
    controller.createConfiguration,
  );

  // 5. Update configuration fields (creates a new version based on active)
  router.patch('/',
    authenticate,
    resolveTenant,
    requireSettingsUpdate,
    controller.updateConfiguration,
  );

  // 6. Rollback to a specific configuration version (creates a new version copying settings from target)
  router.post('/:id/rollback',
    authenticate,
    resolveTenant,
    requireSettingsUpdate,
    controller.rollbackConfiguration,
  );

  return router;
}

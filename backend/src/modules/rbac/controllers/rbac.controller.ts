/**
 * RBAC Controller
 *
 * Transport layer only.
 * Receives request → validates DTO → calls RbacService → returns response.
 *
 * Does NOT contain business logic.
 * Does NOT access databases directly.
 * Does NOT perform authorization (middleware handles that before reaching here).
 */

import type { Request, Response, NextFunction } from 'express';
import type { RbacService } from '../services/rbac.service';
import { CreateRoleSchema } from '../validators/create-role.validator';
import { UpdateRoleSchema } from '../validators/update-role.validator';
import { AssignRoleSchema } from '../validators/assign-role.validator';
import { CreatePermissionSchema } from '../validators/create-permission.validator';
import { AssignPermissionSchema } from '../validators/assign-permission.validator';
import { RbacError } from '../errors/rbac.errors';
import { ZodError } from 'zod';

// --------------------------------------------------------------------------
// Response helpers
// --------------------------------------------------------------------------

function sendSuccess(res: Response, data: unknown, statusCode = 200): void {
  res.status(statusCode).json({
    success: true,
    data,
    requestId: (res.req as Request & { requestId?: string }).requestId ?? '',
    timestamp: new Date().toISOString(),
  });
}

function sendValidationError(res: Response, error: ZodError, req: Request): void {
  res.status(422).json({
    success: false,
    error: {
      code: 'VALIDATION_FAILED',
      message: 'Validation failed.',
      details: error.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      })),
    },
    requestId: req.requestId ?? '',
    timestamp: new Date().toISOString(),
  });
}

// --------------------------------------------------------------------------
// Controller class
// --------------------------------------------------------------------------

export class RbacController {
  constructor(private readonly rbacService: RbacService) {}

  // ============================================================
  // Roles
  // ============================================================

  createRole = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = CreateRoleSchema.safeParse(req.body);
      if (!parsed.success) { sendValidationError(res, parsed.error, req); return; }

      const tenantId = req.user?.tenantId ?? null;
      const actorId = req.user?.userId ?? 'system';

      const role = await this.rbacService.createRole({
        tenantId,
        name: parsed.data.name,
        displayName: parsed.data.displayName,
        description: parsed.data.description,
        actorId,
        requestId: req.requestId ?? 'unknown',
      });

      sendSuccess(res, { role }, 201);
    } catch (err) { next(err); }
  };

  updateRole = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = UpdateRoleSchema.safeParse(req.body);
      if (!parsed.success) { sendValidationError(res, parsed.error, req); return; }

      const tenantId = req.user?.tenantId ?? null;
      const actorId = req.user?.userId ?? 'system';
      const { id } = req.params as { id: string };

      const role = await this.rbacService.updateRole({
        id,
        tenantId,
        ...parsed.data,
        actorId,
        requestId: req.requestId ?? 'unknown',
      });

      sendSuccess(res, { role });
    } catch (err) { next(err); }
  };

  deleteRole = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = req.user?.tenantId ?? null;
      const actorId = req.user?.userId ?? 'system';
      const { id } = req.params as { id: string };

      await this.rbacService.deleteRole({
        id,
        tenantId,
        actorId,
        requestId: req.requestId ?? 'unknown',
      });

      sendSuccess(res, { deleted: true });
    } catch (err) { next(err); }
  };

  getRole = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = req.user?.tenantId ?? null;
      const { id } = req.params as { id: string };
      const role = await this.rbacService.getRoleById(id, tenantId);
      sendSuccess(res, { role });
    } catch (err) { next(err); }
  };

  listRoles = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = req.user?.tenantId ?? null;
      const includeSystem = req.query['includeSystem'] !== 'false';
      const activeOnly = req.query['activeOnly'] === 'true';

      const roles = await this.rbacService.listRoles({ tenantId, includeSystem, activeOnly });
      sendSuccess(res, { roles, total: roles.length });
    } catch (err) { next(err); }
  };

  // ============================================================
  // Permissions
  // ============================================================

  createPermission = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = CreatePermissionSchema.safeParse(req.body);
      if (!parsed.success) { sendValidationError(res, parsed.error, req); return; }

      const actorId = req.user?.userId ?? 'system';
      const parts = parsed.data.name.split('.');

      const permission = await this.rbacService.createPermission({
        name: parsed.data.name,
        displayName: parsed.data.displayName,
        description: parsed.data.description,
        resource: parts.slice(0, -1).join('.'),
        action: parts[parts.length - 1] ?? 'unknown',
        actorId,
        requestId: req.requestId ?? 'unknown',
      });

      sendSuccess(res, { permission }, 201);
    } catch (err) { next(err); }
  };

  updatePermission = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Re-use UpdateRoleSchema pattern for permissions
      const parsed = CreatePermissionSchema.partial().safeParse(req.body);
      if (!parsed.success) { sendValidationError(res, parsed.error, req); return; }

      const actorId = req.user?.userId ?? 'system';
      const { id } = req.params as { id: string };

      const permission = await this.rbacService.updatePermission({
        id,
        displayName: parsed.data.displayName,
        description: parsed.data.description,
        actorId,
        requestId: req.requestId ?? 'unknown',
      });

      sendSuccess(res, { permission });
    } catch (err) { next(err); }
  };

  deletePermission = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const actorId = req.user?.userId ?? 'system';
      const { id } = req.params as { id: string };

      await this.rbacService.deletePermission(id, actorId);
      sendSuccess(res, { deleted: true });
    } catch (err) { next(err); }
  };

  getPermission = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params as { id: string };
      const permission = await this.rbacService.getPermissionById(id);
      sendSuccess(res, { permission });
    } catch (err) { next(err); }
  };

  listPermissions = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const resource = req.query['resource'] as string | undefined;
      const activeOnly = req.query['activeOnly'] === 'true';

      const permissions = await this.rbacService.listPermissions({ resource, activeOnly });
      sendSuccess(res, { permissions, total: permissions.length });
    } catch (err) { next(err); }
  };

  // ============================================================
  // Role ↔ Permission assignment
  // ============================================================

  grantPermissionToRole = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = AssignPermissionSchema.safeParse(req.body);
      if (!parsed.success) { sendValidationError(res, parsed.error, req); return; }

      const tenantId = req.user?.tenantId ?? null;
      const actorId = req.user?.userId ?? 'system';
      const { id: roleId } = req.params as { id: string };

      await this.rbacService.grantPermissionToRole({
        roleId,
        permissionId: parsed.data.permissionId,
        tenantId,
        grantedBy: actorId,
        requestId: req.requestId ?? 'unknown',
      });

      sendSuccess(res, { granted: true });
    } catch (err) { next(err); }
  };

  revokePermissionFromRole = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = req.user?.tenantId ?? null;
      const actorId = req.user?.userId ?? 'system';
      const { id: roleId, permissionId } = req.params as { id: string; permissionId: string };

      await this.rbacService.revokePermissionFromRole({
        roleId,
        permissionId,
        tenantId,
        actorId,
        requestId: req.requestId ?? 'unknown',
      });

      sendSuccess(res, { revoked: true });
    } catch (err) { next(err); }
  };

  // ============================================================
  // User ↔ Role assignment
  // ============================================================

  assignRoleToUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = AssignRoleSchema.safeParse(req.body);
      if (!parsed.success) { sendValidationError(res, parsed.error, req); return; }

      const tenantId = req.user?.tenantId ?? 'unknown';
      const actorId = req.user?.userId ?? 'system';

      const userRole = await this.rbacService.assignRoleToUser({
        userId: parsed.data.userId,
        roleId: parsed.data.roleId,
        tenantId,
        clinicId: parsed.data.clinicId,
        assignedBy: actorId,
        expiresAt: parsed.data.expiresAt ?? undefined,
        requestId: req.requestId ?? 'unknown',
      });

      sendSuccess(res, { userRole }, 201);
    } catch (err) { next(err); }
  };

  revokeRoleFromUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = req.user?.tenantId ?? 'unknown';
      const actorId = req.user?.userId ?? 'system';
      const { userId, roleId } = req.params as { userId: string; roleId: string };

      await this.rbacService.revokeRoleFromUser({
        userId,
        roleId,
        tenantId,
        actorId,
        requestId: req.requestId ?? 'unknown',
      });

      sendSuccess(res, { revoked: true });
    } catch (err) { next(err); }
  };

  getUserRoles = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = req.user?.tenantId ?? 'unknown';
      const { userId } = req.params as { userId: string };

      const userRoles = await this.rbacService.getUserRoles(userId, tenantId);
      sendSuccess(res, { userRoles, total: userRoles.length });
    } catch (err) { next(err); }
  };
}

// --------------------------------------------------------------------------
// Global RBAC error handler (attach to Express app after router)
// --------------------------------------------------------------------------

export function rbacErrorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (err instanceof RbacError) {
    res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        details: [],
      },
      requestId: req.requestId ?? '',
      timestamp: new Date().toISOString(),
    });
    return;
  }
  next(err);
}

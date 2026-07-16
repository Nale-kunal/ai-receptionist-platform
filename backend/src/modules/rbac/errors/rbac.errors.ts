/**
 * RBAC Domain Errors
 *
 * All typed errors specific to the RBAC module.
 * Follows the same pattern as auth.errors.ts — each error carries
 * its HTTP status code so the global error handler can map without
 * knowing domain logic.
 *
 * SECURITY: Error messages are deliberately vague — do not reveal
 * which specific permission or role check failed beyond "Insufficient permissions."
 */

export class RbacError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = this.constructor.name;
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

// --------------------------------------------------------------------------
// Authorization Errors
// --------------------------------------------------------------------------

export class ForbiddenError extends RbacError {
  constructor(message = 'Insufficient permissions.') {
    super(message, 'FORBIDDEN', 403);
  }
}

export class UnauthorizedError extends RbacError {
  constructor() {
    super('Authentication required.', 'UNAUTHORIZED', 401);
  }
}

export class TenantIsolationViolationError extends RbacError {
  constructor() {
    super('Access denied. Tenant context mismatch.', 'TENANT_ISOLATION_VIOLATION', 403);
  }
}

export class ClinicIsolationViolationError extends RbacError {
  constructor() {
    super('Access denied. Clinic context mismatch.', 'CLINIC_ISOLATION_VIOLATION', 403);
  }
}

// --------------------------------------------------------------------------
// Role Errors
// --------------------------------------------------------------------------

export class RoleNotFoundError extends RbacError {
  constructor() {
    super('Role not found.', 'RBAC_ROLE_NOT_FOUND', 404);
  }
}

export class RoleAlreadyExistsError extends RbacError {
  constructor() {
    super('A role with this name already exists in this tenant.', 'RBAC_ROLE_ALREADY_EXISTS', 409);
  }
}

export class SystemRoleModificationError extends RbacError {
  constructor() {
    super('System roles cannot be modified or deleted.', 'RBAC_SYSTEM_ROLE_PROTECTED', 403);
  }
}

export class RoleAlreadyAssignedError extends RbacError {
  constructor() {
    super('This role is already assigned to the user.', 'RBAC_ROLE_ALREADY_ASSIGNED', 409);
  }
}

export class RoleNotAssignedError extends RbacError {
  constructor() {
    super('This role is not assigned to the user.', 'RBAC_ROLE_NOT_ASSIGNED', 404);
  }
}

// --------------------------------------------------------------------------
// Permission Errors
// --------------------------------------------------------------------------

export class PermissionNotFoundError extends RbacError {
  constructor() {
    super('Permission not found.', 'RBAC_PERMISSION_NOT_FOUND', 404);
  }
}

export class PermissionAlreadyExistsError extends RbacError {
  constructor() {
    super('A permission with this name already exists.', 'RBAC_PERMISSION_ALREADY_EXISTS', 409);
  }
}

export class PermissionAlreadyGrantedError extends RbacError {
  constructor() {
    super('This permission is already granted to the role.', 'RBAC_PERMISSION_ALREADY_GRANTED', 409);
  }
}

export class InvalidPermissionNameError extends RbacError {
  constructor() {
    super('Permission name must follow the format "resource.action".', 'RBAC_INVALID_PERMISSION_NAME', 422);
  }
}

/**
 * RBAC Service Interfaces
 *
 * Public contracts for all RBAC services.
 * Consumers depend on these interfaces, not concrete classes.
 */

import type { PermissionName } from '../constants/rbac.constants';
import type {
  SafeRole,
  SafePermission,
  SafeUserRole,
  ResolvedPermissions,
  AuthorizationResult,
  RbacContext,
  PermissionCheckInput,
  AnyPermissionCheckInput,
  AllPermissionsCheckInput,
} from '../types/rbac.types';

// --------------------------------------------------------------------------
// IRbacService — Role and Permission CRUD + Assignment
// --------------------------------------------------------------------------

export interface IRbacService {
  // Role management
  createRole(params: CreateRoleParams): Promise<SafeRole>;
  updateRole(params: UpdateRoleParams): Promise<SafeRole>;
  deleteRole(params: DeleteRoleParams): Promise<void>;
  getRoleById(id: string, tenantId: string | null): Promise<SafeRole>;
  listRoles(params: ListRolesParams): Promise<SafeRole[]>;

  // Permission management
  createPermission(params: CreatePermissionParams): Promise<SafePermission>;
  updatePermission(params: UpdatePermissionParams): Promise<SafePermission>;
  deletePermission(id: string, actorId: string): Promise<void>;
  getPermissionById(id: string): Promise<SafePermission>;
  listPermissions(params: ListPermissionsParams): Promise<SafePermission[]>;

  // Role ↔ Permission assignment
  grantPermissionToRole(params: GrantPermissionParams): Promise<void>;
  revokePermissionFromRole(params: RevokePermissionParams): Promise<void>;

  // User ↔ Role assignment
  assignRoleToUser(params: AssignRoleParams): Promise<SafeUserRole>;
  revokeRoleFromUser(params: RevokeRoleParams): Promise<void>;
  getUserRoles(userId: string, tenantId: string): Promise<SafeUserRole[]>;
}

// --------------------------------------------------------------------------
// IPermissionEvaluator — Core Authorization Engine
// --------------------------------------------------------------------------

export interface IPermissionEvaluator {
  /** Check a single required permission — throws ForbiddenError if denied */
  authorize(input: PermissionCheckInput): Promise<AuthorizationResult>;

  /** Returns true if user has AT LEAST ONE of the required permissions */
  hasAnyPermission(input: AnyPermissionCheckInput): Promise<boolean>;

  /** Returns true if user has ALL of the required permissions */
  hasAllPermissions(input: AllPermissionsCheckInput): Promise<boolean>;

  /** Resolve all permissions for a user (used by cache + middleware) */
  resolvePermissions(context: RbacContext): Promise<ResolvedPermissions>;

  /** Check if user has a specific role */
  hasRole(context: RbacContext, roleName: string): Promise<boolean>;
}

// --------------------------------------------------------------------------
// IPermissionCacheService
// --------------------------------------------------------------------------

export interface IPermissionCacheService {
  get(cacheKey: string): ResolvedPermissions | undefined;
  set(cacheKey: string, value: ResolvedPermissions): void;
  invalidate(cacheKey: string): void;
  invalidateByUserId(userId: string): void;
  invalidateByTenantId(tenantId: string): void;
  clear(): void;
  size(): number;
}

// --------------------------------------------------------------------------
// Parameter Types
// --------------------------------------------------------------------------

export interface CreateRoleParams {
  tenantId: string | null;
  name: string;
  displayName: string;
  description?: string;
  actorId: string;
  requestId: string;
}

export interface UpdateRoleParams {
  id: string;
  tenantId: string | null;
  displayName?: string;
  description?: string;
  isActive?: boolean;
  actorId: string;
  requestId: string;
}

export interface DeleteRoleParams {
  id: string;
  tenantId: string | null;
  actorId: string;
  requestId: string;
}

export interface ListRolesParams {
  tenantId: string | null;
  includeSystem?: boolean;
  activeOnly?: boolean;
}

export interface CreatePermissionParams {
  name: PermissionName | string;
  displayName: string;
  description?: string;
  resource: string;
  action: string;
  actorId: string;
  requestId: string;
}

export interface UpdatePermissionParams {
  id: string;
  displayName?: string;
  description?: string;
  isActive?: boolean;
  actorId: string;
  requestId: string;
}

export interface ListPermissionsParams {
  resource?: string;
  activeOnly?: boolean;
}

export interface GrantPermissionParams {
  roleId: string;
  permissionId: string;
  tenantId: string | null;
  grantedBy: string;
  requestId: string;
}

export interface RevokePermissionParams {
  roleId: string;
  permissionId: string;
  tenantId: string | null;
  actorId: string;
  requestId: string;
}

export interface AssignRoleParams {
  userId: string;
  roleId: string;
  tenantId: string;
  clinicId?: string | null;
  assignedBy: string;
  expiresAt?: Date;
  requestId: string;
}

export interface RevokeRoleParams {
  userId: string;
  roleId: string;
  tenantId: string;
  actorId: string;
  requestId: string;
}

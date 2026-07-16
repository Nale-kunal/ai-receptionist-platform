/**
 * RBAC Types
 *
 * Plain TypeScript types (not classes) used across the RBAC module.
 * Safe to serialize. No Prisma imports — only domain types.
 */

import type { PermissionName, AuthorizationOutcome } from '../constants/rbac.constants';

// --------------------------------------------------------------------------
// RBAC Context (built from req.user after authentication)
// --------------------------------------------------------------------------

/**
 * The authorization context carried per-request.
 * Built from the authenticated user and resolved permissions.
 */
export interface RbacContext {
  userId: string;
  tenantId: string;
  clinicId: string | null;
  /** Role name from the user record or resolved UserRole */
  role: string;
  /** The session that created this context */
  sessionId: string;
  /** Request trace ID */
  requestId: string;
  /** IP address for audit */
  ipAddress: string;
}

// --------------------------------------------------------------------------
// Authorization Result
// --------------------------------------------------------------------------

export interface AuthorizationResult {
  outcome: AuthorizationOutcome;
  userId: string;
  tenantId: string;
  clinicId: string | null;
  role: string;
  /** The permission that was checked */
  requiredPermission: string | null;
  /** Set of permissions the user currently holds */
  grantedPermissions: Set<string>;
  /** Why it was denied (for audit — never returned to client) */
  denyReason?: string;
}

// --------------------------------------------------------------------------
// Safe Role (public-facing, no internal IDs)
// --------------------------------------------------------------------------

export interface SafeRole {
  id: string;
  tenantId: string | null;
  name: string;
  displayName: string;
  description: string | null;
  isSystem: boolean;
  isActive: boolean;
  permissionCount: number;
  createdAt: Date;
  updatedAt: Date;
}

// --------------------------------------------------------------------------
// Safe Permission (public-facing)
// --------------------------------------------------------------------------

export interface SafePermission {
  id: string;
  name: string;
  displayName: string;
  description: string | null;
  resource: string;
  action: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// --------------------------------------------------------------------------
// Safe User Role Assignment (public-facing)
// --------------------------------------------------------------------------

export interface SafeUserRole {
  id: string;
  userId: string;
  roleId: string;
  roleName: string;
  roleDisplayName: string;
  tenantId: string;
  clinicId: string | null;
  assignedAt: Date;
  assignedBy: string | null;
  expiresAt: Date | null;
  isActive: boolean;
}

// --------------------------------------------------------------------------
// Resolved Permissions (cache value)
// --------------------------------------------------------------------------

export interface ResolvedPermissions {
  userId: string;
  tenantId: string;
  clinicId: string | null;
  roleNames: string[];
  permissions: Set<string>;
  resolvedAt: Date;
  expiresAt: Date;
}

// --------------------------------------------------------------------------
// Permission Evaluation Input
// --------------------------------------------------------------------------

export interface PermissionCheckInput {
  context: RbacContext;
  requiredPermission: PermissionName;
  /** Optional: the resource's tenantId for ownership validation */
  resourceTenantId?: string;
  /** Optional: the resource's clinicId for clinic isolation */
  resourceClinicId?: string;
}

export interface AnyPermissionCheckInput {
  context: RbacContext;
  requiredPermissions: readonly PermissionName[];
  resourceTenantId?: string;
  resourceClinicId?: string;
}

export interface AllPermissionsCheckInput {
  context: RbacContext;
  requiredPermissions: readonly PermissionName[];
  resourceTenantId?: string;
  resourceClinicId?: string;
}

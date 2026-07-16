/**
 * RBAC Domain Events
 *
 * Immutable event value objects emitted by RbacService.
 * Per Engineering Constitution Principle 14 — events describe completed facts.
 */

// --------------------------------------------------------------------------
// Base Event
// --------------------------------------------------------------------------

interface BaseRbacEvent {
  readonly eventType: string;
  readonly occurredAt: Date;
  readonly requestId: string;
  readonly tenantId: string | null;
  readonly actorId: string | null;
  readonly ipAddress: string;
}

// --------------------------------------------------------------------------
// Role Events
// --------------------------------------------------------------------------

export interface RoleCreatedEvent extends BaseRbacEvent {
  readonly eventType: 'rbac.role.created';
  readonly roleId: string;
  readonly roleName: string;
  readonly isSystem: boolean;
}

export interface RoleUpdatedEvent extends BaseRbacEvent {
  readonly eventType: 'rbac.role.updated';
  readonly roleId: string;
  readonly roleName: string;
  readonly changes: Record<string, unknown>;
}

export interface RoleDeletedEvent extends BaseRbacEvent {
  readonly eventType: 'rbac.role.deleted';
  readonly roleId: string;
  readonly roleName: string;
}

// --------------------------------------------------------------------------
// Permission Events
// --------------------------------------------------------------------------

export interface PermissionCreatedEvent extends BaseRbacEvent {
  readonly eventType: 'rbac.permission.created';
  readonly permissionId: string;
  readonly permissionName: string;
}

export interface PermissionUpdatedEvent extends BaseRbacEvent {
  readonly eventType: 'rbac.permission.updated';
  readonly permissionId: string;
  readonly permissionName: string;
  readonly changes: Record<string, unknown>;
}

export interface PermissionDeletedEvent extends BaseRbacEvent {
  readonly eventType: 'rbac.permission.deleted';
  readonly permissionId: string;
  readonly permissionName: string;
}

// --------------------------------------------------------------------------
// Role Assignment Events
// --------------------------------------------------------------------------

export interface RoleAssignedToUserEvent extends BaseRbacEvent {
  readonly eventType: 'rbac.role.assigned';
  readonly userId: string;
  readonly roleId: string;
  readonly roleName: string;
  readonly clinicId: string | null;
}

export interface RoleRevokedFromUserEvent extends BaseRbacEvent {
  readonly eventType: 'rbac.role.revoked';
  readonly userId: string;
  readonly roleId: string;
  readonly roleName: string;
}

// --------------------------------------------------------------------------
// Permission Assignment Events
// --------------------------------------------------------------------------

export interface PermissionGrantedToRoleEvent extends BaseRbacEvent {
  readonly eventType: 'rbac.permission.granted';
  readonly roleId: string;
  readonly roleName: string;
  readonly permissionId: string;
  readonly permissionName: string;
}

export interface PermissionRevokedFromRoleEvent extends BaseRbacEvent {
  readonly eventType: 'rbac.permission.revoked';
  readonly roleId: string;
  readonly roleName: string;
  readonly permissionId: string;
  readonly permissionName: string;
}

// --------------------------------------------------------------------------
// Authorization Events
// --------------------------------------------------------------------------

export interface AuthorizationGrantedEvent extends BaseRbacEvent {
  readonly eventType: 'rbac.authorization.granted';
  readonly userId: string;
  readonly clinicId: string | null;
  readonly requiredPermission: string;
  readonly role: string;
}

export interface AuthorizationDeniedEvent extends BaseRbacEvent {
  readonly eventType: 'rbac.authorization.denied';
  readonly userId: string | null;
  readonly clinicId: string | null;
  readonly requiredPermission: string;
  readonly role: string | null;
  readonly reason: string;
}

// --------------------------------------------------------------------------
// Union Type
// --------------------------------------------------------------------------

export type RbacDomainEvent =
  | RoleCreatedEvent
  | RoleUpdatedEvent
  | RoleDeletedEvent
  | PermissionCreatedEvent
  | PermissionUpdatedEvent
  | PermissionDeletedEvent
  | RoleAssignedToUserEvent
  | RoleRevokedFromUserEvent
  | PermissionGrantedToRoleEvent
  | PermissionRevokedFromRoleEvent
  | AuthorizationGrantedEvent
  | AuthorizationDeniedEvent;

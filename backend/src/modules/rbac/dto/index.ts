/**
 * DTO Barrel — RBAC module
 * Re-exports all Zod-inferred DTO types.
 */

export type { CreateRoleDTO } from '../validators/create-role.validator';
export type { UpdateRoleDTO } from '../validators/update-role.validator';
export type { AssignRoleDTO } from '../validators/assign-role.validator';
export type { CreatePermissionDTO } from '../validators/create-permission.validator';
export type { AssignPermissionDTO } from '../validators/assign-permission.validator';

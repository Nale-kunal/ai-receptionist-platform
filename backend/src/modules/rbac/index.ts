/**
 * RBAC Module — Public API
 *
 * ONLY import from this file when consuming the RBAC module from outside.
 * Do NOT import directly from internal paths (services/, repositories/, etc.).
 */

// Constants
export {
  ROLE_SUPER_ADMIN,
  ROLE_ADMIN,
  ROLE_RECEPTIONIST,
  ROLE_DOCTOR,
  ROLE_PATIENT,
  SYSTEM_ROLES,
  ALL_PERMISSIONS,
  SUPER_ADMIN_PERMISSIONS,
  ADMIN_PERMISSIONS,
  RECEPTIONIST_PERMISSIONS,
  DOCTOR_PERMISSIONS,
  PATIENT_PERMISSIONS,
  PERMISSION_CACHE_TTL_SECONDS,
  RBAC_ROUTE_PREFIX,
  OUTCOME_GRANTED,
  OUTCOME_DENIED,
  // Permission name constants
  PERM_CLINIC_READ,
  PERM_CLINIC_UPDATE,
  PERM_CLINIC_SETTINGS_READ,
  PERM_CLINIC_SETTINGS_UPDATE,
  PERM_CLINIC_DELETE,
  PERM_DOCTOR_CREATE,
  PERM_DOCTOR_READ,
  PERM_DOCTOR_UPDATE,
  PERM_DOCTOR_DELETE,
  PERM_PATIENT_CREATE,
  PERM_PATIENT_READ,
  PERM_PATIENT_UPDATE,
  PERM_PATIENT_DELETE,
  PERM_APPOINTMENT_CREATE,
  PERM_APPOINTMENT_READ,
  PERM_APPOINTMENT_UPDATE,
  PERM_APPOINTMENT_DELETE,
  PERM_APPOINTMENT_CANCEL,
  PERM_APPOINTMENT_RESCHEDULE,
  PERM_CONVERSATION_READ,
  PERM_CONVERSATION_SUMMARY,
  PERM_CONVERSATION_DELETE,
  PERM_USER_INVITE,
  PERM_USER_READ,
  PERM_USER_UPDATE,
  PERM_USER_DISABLE,
  PERM_USER_DELETE,
  PERM_NOTIFICATION_READ,
  PERM_NOTIFICATION_SEND,
  PERM_CALENDAR_READ,
  PERM_CALENDAR_WRITE,
  PERM_AI_CONFIG_READ,
  PERM_AI_CONFIG_UPDATE,
  PERM_PROMPT_READ,
  PERM_PROMPT_UPDATE,
  PERM_REPORT_VIEW,
  PERM_BILLING_READ,
  PERM_BILLING_MANAGE,
  PERM_ADMIN_TENANT_MANAGE,
  PERM_ADMIN_PLATFORM,
  PERM_RBAC_ROLE_MANAGE,
  PERM_RBAC_PERMISSION_MANAGE,
} from './constants/rbac.constants';
export type { PermissionName, SystemRoleName, AuthorizationOutcome } from './constants/rbac.constants';

export {
  CUSTOMER_ROLES_MAP,
  ALLOWED_CUSTOMER_ROLES,
  isValidCustomerRole,
  getRoleDisplayName,
} from './constants/role-config.constants';
export type { CustomerRoleDef } from './constants/role-config.constants';

// Errors
export {
  RbacError,
  ForbiddenError,
  UnauthorizedError,
  TenantIsolationViolationError,
  ClinicIsolationViolationError,
  RoleNotFoundError,
  RoleAlreadyExistsError,
  SystemRoleModificationError,
  RoleAlreadyAssignedError,
  RoleNotAssignedError,
  PermissionNotFoundError,
  PermissionAlreadyExistsError,
  PermissionAlreadyGrantedError,
  InvalidPermissionNameError,
} from './errors/rbac.errors';

// Types
export type {
  RbacContext,
  AuthorizationResult,
  SafeRole,
  SafePermission,
  SafeUserRole,
  ResolvedPermissions,
  PermissionCheckInput,
  AnyPermissionCheckInput,
  AllPermissionsCheckInput,
} from './types/rbac.types';

// Interfaces
export type {
  IRbacService,
  IPermissionEvaluator,
  IPermissionCacheService,
  CreateRoleParams,
  UpdateRoleParams,
  DeleteRoleParams,
  ListRolesParams,
  CreatePermissionParams,
  UpdatePermissionParams,
  ListPermissionsParams,
  GrantPermissionParams,
  RevokePermissionParams,
  AssignRoleParams,
  RevokeRoleParams,
} from './interfaces/rbac.interfaces';

// Events
export type { RbacDomainEvent } from './events/rbac.events';
export { InProcessRbacEventPublisher } from './events/rbac-event.publisher';
export type { RbacEventPublisher } from './events/rbac-event.publisher';

// Repositories (injected by app composition root)
export { RoleRepository } from './repositories/role.repository';
export { PermissionRepository } from './repositories/permission.repository';
export { UserRoleRepository } from './repositories/user-role.repository';

// Services
export { PermissionCacheService } from './services/permission-cache.service';
export { PermissionEvaluatorService } from './services/permission-evaluator.service';
export { RbacService } from './services/rbac.service';
export { RbacBootstrapService } from './services/rbac-bootstrap.service';

// Controller
export { RbacController, rbacErrorHandler } from './controllers/rbac.controller';

// Middleware
export {
  createAuthorizeMiddleware,
  createRequirePermission,
  createRequireRole,
  createRequireAnyPermission,
  createRequireAllPermissions,
} from './middleware/authorize.middleware';
export type { AuthorizeMiddleware } from './middleware/authorize.middleware';

// Routes
export { createRbacRouter } from './routes/rbac.routes';
export type { RbacRouterDeps } from './routes/rbac.routes';

/**
 * Permission Evaluator Service
 *
 * THE core authorization engine.
 *
 * Authorization flow (per RBAC Contract §Authorization Flow):
 *   1. User authenticated (asserted by caller — JWT already validated)
 *   2. Resolve role IDs for the user in the tenant
 *   3. Resolve permission names for those roles (from cache or DB)
 *   4. Verify tenant isolation
 *   5. Verify clinic isolation (if resource has a clinicId)
 *   6. Check required permission exists in resolved set
 *   7. Publish audit event
 *   8. Return AuthorizationResult
 *
 * SECURITY:
 *   - Default deny: explicit grant required
 *   - Tenant isolation enforced on every check
 *   - Clinic isolation enforced when resourceClinicId provided
 *   - Audit events published on every granted AND denied check
 *   - Never discloses what permission is missing to the caller
 */

import type { UserRoleRepository } from '../repositories/user-role.repository';
import type { PermissionRepository } from '../repositories/permission.repository';
import { PermissionCacheService } from './permission-cache.service';
import type { RbacEventPublisher } from '../events/rbac-event.publisher';
import type { IPermissionEvaluator } from '../interfaces/rbac.interfaces';
import type {
  RbacContext,
  AuthorizationResult,
  ResolvedPermissions,
  PermissionCheckInput,
  AnyPermissionCheckInput,
  AllPermissionsCheckInput,
} from '../types/rbac.types';
import { OUTCOME_GRANTED, OUTCOME_DENIED } from '../constants/rbac.constants';
import {
  ForbiddenError,
  TenantIsolationViolationError,
  ClinicIsolationViolationError,
} from '../errors/rbac.errors';
import type { AuthorizationDeniedEvent, AuthorizationGrantedEvent } from '../events/rbac.events';

export class PermissionEvaluatorService implements IPermissionEvaluator {
  constructor(
    private readonly userRoleRepository: UserRoleRepository,
    private readonly permissionRepository: PermissionRepository,
    private readonly cache: PermissionCacheService,
    private readonly eventPublisher: RbacEventPublisher,
  ) {}

  // --------------------------------------------------------------------------
  // IPermissionEvaluator.authorize
  // --------------------------------------------------------------------------

  public async authorize(input: PermissionCheckInput): Promise<AuthorizationResult> {
    const { context, requiredPermission, resourceTenantId, resourceClinicId } = input;

    // Step 1 — Tenant isolation: resource must belong to the caller's tenant
    if (resourceTenantId !== undefined && resourceTenantId !== context.tenantId) {
      await this.publishDenied(context, requiredPermission, 'tenant_isolation_violation');
      throw new TenantIsolationViolationError();
    }

    // Step 2 — Resolve permissions
    const resolved = await this.resolvePermissions(context);

    // Step 3 — Clinic isolation: resource must belong to the caller's clinic (if caller has one)
    if (
      resourceClinicId !== undefined &&
      context.clinicId !== null &&
      resourceClinicId !== context.clinicId
    ) {
      await this.publishDenied(context, requiredPermission, 'clinic_isolation_violation');
      throw new ClinicIsolationViolationError();
    }

    // Step 4 — Default deny permission check
    const granted = resolved.permissions.has(requiredPermission);

    const result: AuthorizationResult = {
      outcome: granted ? OUTCOME_GRANTED : OUTCOME_DENIED,
      userId: context.userId,
      tenantId: context.tenantId,
      clinicId: context.clinicId,
      role: context.role,
      requiredPermission,
      grantedPermissions: resolved.permissions,
      denyReason: granted ? undefined : 'permission_not_granted',
    };

    if (!granted) {
      await this.publishDenied(context, requiredPermission, 'permission_not_granted');
      throw new ForbiddenError();
    }

    await this.publishGranted(context, requiredPermission);
    return result;
  }

  // --------------------------------------------------------------------------
  // IPermissionEvaluator.hasAnyPermission
  // --------------------------------------------------------------------------

  public async hasAnyPermission(input: AnyPermissionCheckInput): Promise<boolean> {
    const { context, requiredPermissions, resourceTenantId, resourceClinicId } = input;

    if (resourceTenantId !== undefined && resourceTenantId !== context.tenantId) {
      return false;
    }

    if (
      resourceClinicId !== undefined &&
      context.clinicId !== null &&
      resourceClinicId !== context.clinicId
    ) {
      return false;
    }

    const resolved = await this.resolvePermissions(context);
    return requiredPermissions.some((p) => resolved.permissions.has(p));
  }

  // --------------------------------------------------------------------------
  // IPermissionEvaluator.hasAllPermissions
  // --------------------------------------------------------------------------

  public async hasAllPermissions(input: AllPermissionsCheckInput): Promise<boolean> {
    const { context, requiredPermissions, resourceTenantId, resourceClinicId } = input;

    if (resourceTenantId !== undefined && resourceTenantId !== context.tenantId) {
      return false;
    }

    if (
      resourceClinicId !== undefined &&
      context.clinicId !== null &&
      resourceClinicId !== context.clinicId
    ) {
      return false;
    }

    const resolved = await this.resolvePermissions(context);
    return requiredPermissions.every((p) => resolved.permissions.has(p));
  }

  // --------------------------------------------------------------------------
  // IPermissionEvaluator.resolvePermissions
  // --------------------------------------------------------------------------

  public async resolvePermissions(context: RbacContext): Promise<ResolvedPermissions> {
    const cacheKey = PermissionCacheService.buildKey(context.userId, context.tenantId);

    // Cache hit
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    // Cache miss — resolve from DB
    const roleIds = await this.userRoleRepository.findActiveRoleIds(
      context.userId,
      context.tenantId,
    );

    let permissions: Set<string>;

    if (roleIds.length === 0) {
      // No roles assigned — empty permission set (default deny)
      permissions = new Set();
    } else {
      permissions = await this.permissionRepository.findPermissionNamesForRoles(roleIds);
    }

    // Resolve role names for this context
    const userRolesWithRole = await this.userRoleRepository.findActiveByUser(
      context.userId,
      context.tenantId,
    );
    const roleNames = userRolesWithRole.map((ur) => ur.role.name);

    const resolved: ResolvedPermissions = {
      userId: context.userId,
      tenantId: context.tenantId,
      clinicId: context.clinicId,
      roleNames,
      permissions,
      resolvedAt: new Date(),
      expiresAt: this.cache.buildExpiresAt(),
    };

    this.cache.set(cacheKey, resolved);
    return resolved;
  }

  // --------------------------------------------------------------------------
  // IPermissionEvaluator.hasRole
  // --------------------------------------------------------------------------

  public async hasRole(context: RbacContext, roleName: string): Promise<boolean> {
    const resolved = await this.resolvePermissions(context);
    return resolved.roleNames.includes(roleName);
  }

  // --------------------------------------------------------------------------
  // Audit helpers
  // --------------------------------------------------------------------------

  private async publishGranted(context: RbacContext, permission: string): Promise<void> {
    const event: AuthorizationGrantedEvent = {
      eventType: 'rbac.authorization.granted',
      occurredAt: new Date(),
      requestId: context.requestId,
      tenantId: context.tenantId,
      actorId: context.userId,
      ipAddress: context.ipAddress,
      userId: context.userId,
      clinicId: context.clinicId,
      requiredPermission: permission,
      role: context.role,
    };
    // Fire-and-forget
    void this.eventPublisher.publish(event);
  }

  private async publishDenied(
    context: RbacContext,
    permission: string,
    reason: string,
  ): Promise<void> {
    const event: AuthorizationDeniedEvent = {
      eventType: 'rbac.authorization.denied',
      occurredAt: new Date(),
      requestId: context.requestId,
      tenantId: context.tenantId,
      actorId: context.userId,
      ipAddress: context.ipAddress,
      userId: context.userId,
      clinicId: context.clinicId,
      requiredPermission: permission,
      role: context.role,
      reason,
    };
    void this.eventPublisher.publish(event);
  }
}

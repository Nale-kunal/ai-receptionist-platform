import type { IToolAuthorization } from './ai-tool.interfaces';
import type { IAiTool } from './ai-tool.interfaces';
import type { ExecutionContext } from './ai-tool.types';
import { AuthorizationFailure, TenantFailure } from './ai-tool.errors';
import type { PermissionEvaluatorService } from '../rbac/services/permission-evaluator.service';
import type { UserRoleRepository } from '../rbac/repositories/user-role.repository';

export class ToolAuthorization implements IToolAuthorization {
  constructor(
    private readonly permissionEvaluator: PermissionEvaluatorService,
    private readonly userRoleRepository: UserRoleRepository
  ) {}

  public async authorize(tool: IAiTool, context: ExecutionContext): Promise<void> {
    // 1. Tenant Context verification
    if (tool.metadata.requiredTenantScope) {
      if (!context.tenantId) {
        throw new TenantFailure('Execution blocked: Missing required tenant scope parameter.');
      }
    }

    // 2. Enforce RBAC permission checks
    if (tool.metadata.requiredPermissions.length > 0) {
      if (!context.userId) {
        throw new AuthorizationFailure('Execution blocked: Unauthenticated execution request.');
      }

      const userRoles = await this.userRoleRepository.findActiveByUser(context.userId, context.tenantId);
      if (userRoles.length === 0) {
        throw new AuthorizationFailure('Authorization failed. User has no active roles.');
      }
      const roleName = userRoles[0].role.name;

      for (const permission of tool.metadata.requiredPermissions) {
        try {
          await this.permissionEvaluator.authorize({
            context: {
              userId: context.userId,
              tenantId: context.tenantId,
              clinicId: context.clinicId,
              role: roleName,
              sessionId: context.sessionId,
              requestId: context.correlationId,
              ipAddress: '127.0.0.1',
            },
            requiredPermission: permission as any,
            resourceTenantId: context.tenantId,
            resourceClinicId: context.clinicId || undefined,
          });
        } catch (err: any) {
          throw new AuthorizationFailure(
            `Authorization failed. User lacks required permission: '${permission}'. Reason: ${err.message}`
          );
        }
      }
    }
  }
}

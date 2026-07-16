/**
 * Authorization Middleware Tests
 */

import type { Request, Response, NextFunction } from 'express';
import { PermissionEvaluatorService } from '../services/permission-evaluator.service';
import { PermissionCacheService } from '../services/permission-cache.service';
import { InProcessRbacEventPublisher } from '../events/rbac-event.publisher';
import {
  createRequirePermission,
  createRequireRole,
  createRequireAnyPermission,
  createRequireAllPermissions,
} from '../middleware/authorize.middleware';
import { ForbiddenError, TenantIsolationViolationError } from '../errors/rbac.errors';
import type { AuthenticatedUser } from '../../authentication/types/auth.types';
import { PERM_APPOINTMENT_READ, PERM_APPOINTMENT_CREATE } from '../constants/rbac.constants';

// --------------------------------------------------------------------------
// Mocks
// --------------------------------------------------------------------------

const mockUserRoleRepository = {
  findActiveRoleIds: jest.fn(),
  findActiveByUser: jest.fn(),
};

const mockPermissionRepository = {
  findPermissionNamesForRoles: jest.fn(),
};

function makeAuthenticatedUser(overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser {
  return {
    userId: 'user-id-1',
    tenantId: 'tenant-id-1',
    clinicId: 'clinic-id-1',
    role: 'admin',
    sessionId: 'sess-id',
    tokenVersion: 0,
    email: 'test@example.com',
    ...overrides,
  };
}

function makeRequest(user: AuthenticatedUser | undefined = makeAuthenticatedUser()): Partial<Request> {
  return {
    user,
    requestId: 'req-id-1',
    headers: {},
    socket: { remoteAddress: '127.0.0.1' } as any,
  } as Partial<Request>;
}

function makeResponse(): { res: Partial<Response>; json: jest.Mock; status: jest.Mock } {
  const json = jest.fn();
  const statusResult = { json };
  const status = jest.fn().mockReturnValue(statusResult);
  const res = { status, json, req: { requestId: 'req-id-1' } } as unknown as Partial<Response>;
  return { res, json, status };
}


// --------------------------------------------------------------------------
// Tests
// --------------------------------------------------------------------------

describe('Authorization Middleware', () => {
  let evaluator: PermissionEvaluatorService;
  let cache: PermissionCacheService;

  beforeEach(() => {
    jest.clearAllMocks();
    cache = new PermissionCacheService(300, 100);
    const publisher = new InProcessRbacEventPublisher();
    evaluator = new PermissionEvaluatorService(
      mockUserRoleRepository as any,
      mockPermissionRepository as any,
      cache,
      publisher,
    );
  });

  // ----------------------------------------------------------------
  // requirePermission
  // ----------------------------------------------------------------

  describe('requirePermission', () => {
    it('should call next() when permission is granted', async () => {
      mockUserRoleRepository.findActiveRoleIds.mockResolvedValue(['role-id-1']);
      mockPermissionRepository.findPermissionNamesForRoles.mockResolvedValue(
        new Set([PERM_APPOINTMENT_READ]),
      );
      mockUserRoleRepository.findActiveByUser.mockResolvedValue([]);

      const middleware = createRequirePermission(evaluator)(PERM_APPOINTMENT_READ);
      const { res } = makeResponse();
      const next = jest.fn();

      await middleware(makeRequest() as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(); // called without error
    });

    it('should return 403 when permission is denied', async () => {
      mockUserRoleRepository.findActiveRoleIds.mockResolvedValue([]);
      mockPermissionRepository.findPermissionNamesForRoles.mockResolvedValue(new Set());
      mockUserRoleRepository.findActiveByUser.mockResolvedValue([]);

      const middleware = createRequirePermission(evaluator)(PERM_APPOINTMENT_READ);
      const { res, status } = makeResponse();
      const next = jest.fn();

      await middleware(makeRequest() as Request, res as Response, next);

      expect(status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 401 when req.user is not set', async () => {
      const middleware = createRequirePermission(evaluator)(PERM_APPOINTMENT_READ);
      const { res, status } = makeResponse();
      const next = jest.fn();

      // Build request with no user
      const noUserReq = {
        user: undefined,
        requestId: 'req-id-1',
        headers: {},
        socket: { remoteAddress: '127.0.0.1' },
      } as unknown as Request;

      await middleware(noUserReq, res as Response, next);

      expect(status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });

    it('should call next(err) for unexpected errors', async () => {
      const boom = new Error('DB connection failed');
      mockUserRoleRepository.findActiveRoleIds.mockRejectedValue(boom);

      const middleware = createRequirePermission(evaluator)(PERM_APPOINTMENT_READ);
      const { res } = makeResponse();
      const next = jest.fn();

      await middleware(makeRequest() as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(boom);
    });
  });

  // ----------------------------------------------------------------
  // requireRole
  // ----------------------------------------------------------------

  describe('requireRole', () => {
    it('should call next() when user has the role', async () => {
      mockUserRoleRepository.findActiveRoleIds.mockResolvedValue(['role-id-1']);
      mockPermissionRepository.findPermissionNamesForRoles.mockResolvedValue(new Set());
      mockUserRoleRepository.findActiveByUser.mockResolvedValue([
        { id: 'ur-1', role: { name: 'admin', displayName: 'Admin' }, tenantId: 'tenant-id-1', userId: 'user-id-1', roleId: 'role-id-1', clinicId: null, assignedAt: new Date(), assignedBy: null, expiresAt: null, isActive: true, revokedAt: null },
      ]);

      const middleware = createRequireRole(evaluator)('admin');
      const { res } = makeResponse();
      const next = jest.fn();

      await middleware(makeRequest() as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith();
    });

    it('should return 403 when user does not have the role', async () => {
      mockUserRoleRepository.findActiveRoleIds.mockResolvedValue([]);
      mockPermissionRepository.findPermissionNamesForRoles.mockResolvedValue(new Set());
      mockUserRoleRepository.findActiveByUser.mockResolvedValue([]);

      const middleware = createRequireRole(evaluator)('super_admin');
      const { res, status } = makeResponse();
      const next = jest.fn();

      await middleware(makeRequest() as Request, res as Response, next);

      expect(status).toHaveBeenCalledWith(403);
    });
  });

  // ----------------------------------------------------------------
  // requireAnyPermission
  // ----------------------------------------------------------------

  describe('requireAnyPermission', () => {
    it('should call next() when user has at least one permission', async () => {
      mockUserRoleRepository.findActiveRoleIds.mockResolvedValue(['role-id-1']);
      mockPermissionRepository.findPermissionNamesForRoles.mockResolvedValue(
        new Set([PERM_APPOINTMENT_READ]),
      );
      mockUserRoleRepository.findActiveByUser.mockResolvedValue([]);

      const middleware = createRequireAnyPermission(evaluator)([
        PERM_APPOINTMENT_READ,
        PERM_APPOINTMENT_CREATE,
      ]);
      const { res } = makeResponse();
      const next = jest.fn();

      await middleware(makeRequest() as Request, res as Response, next);
      expect(next).toHaveBeenCalledWith();
    });

    it('should return 403 when user has none of the permissions', async () => {
      mockUserRoleRepository.findActiveRoleIds.mockResolvedValue([]);
      mockPermissionRepository.findPermissionNamesForRoles.mockResolvedValue(new Set());
      mockUserRoleRepository.findActiveByUser.mockResolvedValue([]);

      const middleware = createRequireAnyPermission(evaluator)([
        PERM_APPOINTMENT_READ,
        PERM_APPOINTMENT_CREATE,
      ]);
      const { res, status } = makeResponse();
      const next = jest.fn();

      await middleware(makeRequest() as Request, res as Response, next);
      expect(status).toHaveBeenCalledWith(403);
    });
  });

  // ----------------------------------------------------------------
  // requireAllPermissions
  // ----------------------------------------------------------------

  describe('requireAllPermissions', () => {
    it('should call next() when user has all permissions', async () => {
      mockUserRoleRepository.findActiveRoleIds.mockResolvedValue(['role-id-1']);
      mockPermissionRepository.findPermissionNamesForRoles.mockResolvedValue(
        new Set([PERM_APPOINTMENT_READ, PERM_APPOINTMENT_CREATE]),
      );
      mockUserRoleRepository.findActiveByUser.mockResolvedValue([]);

      const middleware = createRequireAllPermissions(evaluator)([
        PERM_APPOINTMENT_READ,
        PERM_APPOINTMENT_CREATE,
      ]);
      const { res } = makeResponse();
      const next = jest.fn();

      await middleware(makeRequest() as Request, res as Response, next);
      expect(next).toHaveBeenCalledWith();
    });

    it('should return 403 when user is missing one permission', async () => {
      mockUserRoleRepository.findActiveRoleIds.mockResolvedValue(['role-id-1']);
      mockPermissionRepository.findPermissionNamesForRoles.mockResolvedValue(
        new Set([PERM_APPOINTMENT_READ]), // missing PERM_APPOINTMENT_CREATE
      );
      mockUserRoleRepository.findActiveByUser.mockResolvedValue([]);

      const middleware = createRequireAllPermissions(evaluator)([
        PERM_APPOINTMENT_READ,
        PERM_APPOINTMENT_CREATE,
      ]);
      const { res, status } = makeResponse();
      const next = jest.fn();

      await middleware(makeRequest() as Request, res as Response, next);
      expect(status).toHaveBeenCalledWith(403);
    });
  });
});

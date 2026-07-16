/**
 * RBAC Errors Tests
 */

import {
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
} from '../errors/rbac.errors';

describe('RBAC Errors', () => {
  it('all RBAC errors should extend RbacError', () => {
    const errors = [
      new ForbiddenError(),
      new UnauthorizedError(),
      new TenantIsolationViolationError(),
      new ClinicIsolationViolationError(),
      new RoleNotFoundError(),
      new RoleAlreadyExistsError(),
      new SystemRoleModificationError(),
      new RoleAlreadyAssignedError(),
      new RoleNotAssignedError(),
      new PermissionNotFoundError(),
      new PermissionAlreadyExistsError(),
      new PermissionAlreadyGrantedError(),
      new InvalidPermissionNameError(),
    ];

    for (const err of errors) {
      expect(err).toBeInstanceOf(RbacError);
      expect(err).toBeInstanceOf(Error);
      expect(err.code).toBeTruthy();
      expect(err.statusCode).toBeGreaterThanOrEqual(400);
    }
  });

  it('ForbiddenError should have statusCode 403', () => {
    const err = new ForbiddenError();
    expect(err.statusCode).toBe(403);
    expect(err.code).toBe('FORBIDDEN');
  });

  it('UnauthorizedError should have statusCode 401', () => {
    const err = new UnauthorizedError();
    expect(err.statusCode).toBe(401);
    expect(err.code).toBe('UNAUTHORIZED');
  });

  it('TenantIsolationViolationError should have statusCode 403', () => {
    const err = new TenantIsolationViolationError();
    expect(err.statusCode).toBe(403);
  });

  it('SystemRoleModificationError should have statusCode 403', () => {
    const err = new SystemRoleModificationError();
    expect(err.statusCode).toBe(403);
    expect(err.code).toBe('RBAC_SYSTEM_ROLE_PROTECTED');
  });

  it('InvalidPermissionNameError should have statusCode 422', () => {
    const err = new InvalidPermissionNameError();
    expect(err.statusCode).toBe(422);
  });

  it('RoleAlreadyExistsError should have statusCode 409', () => {
    expect(new RoleAlreadyExistsError().statusCode).toBe(409);
  });

  it('PermissionAlreadyGrantedError should have statusCode 409', () => {
    expect(new PermissionAlreadyGrantedError().statusCode).toBe(409);
  });

  it('error name should match constructor name', () => {
    const err = new ForbiddenError();
    expect(err.name).toBe('ForbiddenError');
  });

  it('error message should not disclose which specific permission was missing', () => {
    const forbidden = new ForbiddenError();
    // Message should be vague — not exposing the exact permission name checked
    expect(forbidden.message).toBe('Insufficient permissions.');
    expect(forbidden.message).not.toContain('appointment');
    expect(forbidden.message).not.toContain('clinic');
  });
});

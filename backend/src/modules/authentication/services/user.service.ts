import argon2 from 'argon2';
import { UserRepository } from '../repositories/user.repository';
import type { User, PrismaClient } from '@prisma/client';
import {
  ARGON2_MEMORY_COST,
  ARGON2_TIME_COST,
  ARGON2_PARALLELISM,
} from '../constants/auth.constants';
import { normalizeEmail } from '../../../shared/utils/email.utils';

export interface CreateUserParams {
  tenantId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  password?: string;
  clinicId?: string | null;
}

export interface UpdateUserParams {
  id: string;
  tenantId: string;
  firstName?: string;
  lastName?: string;
  role?: string;
  status?: string;
  password?: string;
  clinicId?: string | null;
  actorUserId?: string;
  requireAcceptance?: boolean;
}

export class SoleOwnerProtectionError extends Error {
  constructor(message: string = 'Cannot modify, demote, deactivate, or remove the sole Practice Owner. A practice must have at least one active Practice Owner. Transfer ownership or assign another Practice Owner first.') {
    super(message);
    this.name = 'SoleOwnerProtectionError';
  }
}

export class UserService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly publisher?: any,
    private readonly prisma?: PrismaClient,
    private readonly rbacBootstrapService?: any,
    private readonly emailService?: any,
  ) {}

  /**
   * Count active practice owners in a tenant
   */
  private async countActiveOwners(tenantId: string): Promise<number> {
    if (this.prisma) {
      return await this.prisma.user.count({
        where: {
          tenantId,
          role: { in: ['clinic_owner', 'admin'] },
          status: 'active',
          deletedAt: null,
        },
      });
    }
    const allUsers = await this.userRepository.findMany({ tenantId, limit: 100 });
    return allUsers.filter(
      (u) => (u.role === 'clinic_owner' || u.role === 'admin') && u.status === 'active' && !u.deletedAt
    ).length;
  }

  public async createUser(params: CreateUserParams): Promise<User> {
    const { tenantId, email, firstName, lastName, role, password, clinicId } = params;

    const existing = await this.userRepository.findByEmail(email);
    if (existing) {
      throw new Error('Email already registered');
    }

    const tempPassword = password || Math.random().toString(36).substring(2, 12);
    const passwordHash = await argon2.hash(tempPassword, {
      type: argon2.argon2id,
      memoryCost: ARGON2_MEMORY_COST,
      timeCost: ARGON2_TIME_COST,
      parallelism: ARGON2_PARALLELISM,
    });

    const user = await this.userRepository.create({
      email: email.toLowerCase().trim(),
      passwordHash,
      firstName,
      lastName,
      tenantId,
      role: role || 'clinic_owner',
    });

    if (clinicId) {
      await this.userRepository.update(user.id, { clinicId });
    }

    if (this.rbacBootstrapService) {
      try {
        await this.rbacBootstrapService.assignSystemRoleToUser({
          userId: user.id,
          tenantId,
          roleName: user.role,
        });
      } catch (err) {
        console.error('[UserService] UserRole assignment failed:', err);
      }
    }

    if (this.publisher) {
      await this.publisher.publish({
        eventType: 'user.created',
        occurredAt: new Date(),
        requestId: '',
        tenantId,
        userId: user.id,
        email,
      });
    }

    return user;
  }

  public async updateUser(params: UpdateUserParams): Promise<User> {
    const { id, tenantId, firstName, lastName, role, status, password, clinicId, actorUserId, requireAcceptance = true } = params;

    const user = await this.userRepository.findById(id);
    if (!user) {
      throw new Error('User not found');
    }
    if (user.tenantId !== tenantId) {
      throw new Error('Tenant isolation violation');
    }

    const isOwner = user.role === 'clinic_owner' || user.role === 'admin';
    const isDowngradingRole = role !== undefined && role !== user.role && (role !== 'clinic_owner' && role !== 'admin');
    const isDeactivating = status !== undefined && status !== 'active';

    // ── LAST OWNER & SELF-DEMOTION PROTECTION GUARD ──
    if (isOwner && (isDowngradingRole || isDeactivating)) {
      const activeOwners = await this.countActiveOwners(tenantId);
      if (activeOwners <= 1) {
        throw new SoleOwnerProtectionError();
      }
    }

    const updateData: any = {};
    if (firstName !== undefined) updateData.firstName = firstName;
    if (lastName !== undefined) updateData.lastName = lastName;
    if (status !== undefined) updateData.status = status;
    if (clinicId !== undefined) updateData.clinicId = clinicId;

    const isRoleChangeProposed = role !== undefined && role !== user.role;

    // If requireAcceptance is false (e.g. owner transfer or direct force override), update role immediately.
    // Otherwise, keep current user.role intact and issue a pending role_change invitation so the user can accept/decline.
    if (isRoleChangeProposed && !requireAcceptance) {
      updateData.role = role;
      updateData.tokenVersion = (user.tokenVersion || 0) + 1;
    }

    if (password) {
      updateData.passwordHash = await argon2.hash(password, {
        type: argon2.argon2id,
        memoryCost: ARGON2_MEMORY_COST,
        timeCost: ARGON2_TIME_COST,
        parallelism: ARGON2_PARALLELISM,
      });
      updateData.tokenVersion = (user.tokenVersion || 0) + 1;
    }

    const updatedUser = await this.userRepository.update(id, updateData);

    // Synchronize user_roles table ONLY if role was updated immediately
    if (isRoleChangeProposed && !requireAcceptance && this.rbacBootstrapService) {
      try {
        await this.rbacBootstrapService.assignSystemRoleToUser({
          userId: id,
          tenantId,
          roleName: role,
        });
      } catch (err) {
        console.error('[UserService] Failed to update RBAC UserRole table:', err);
      }
    }

    // Trigger role change email notification and issue pending invitation
    if (isRoleChangeProposed && this.emailService) {
      try {
        let tenantName = 'Practice';
        if (this.prisma) {
          const t = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
          if (t?.name) tenantName = t.name;
        }

        const crypto = await import('crypto');
        const rawToken = crypto.randomBytes(32).toString('hex');
        const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

        if (this.prisma && requireAcceptance) {
          // Revoke any previous pending invitations for this email to prevent multiple active invites
          await this.prisma.invitation.updateMany({
            where: { tenantId, email: user.email, status: { in: ['pending', 'viewed'] } },
            data: { status: 'revoked' },
          }).catch(() => {});

          await this.prisma.invitation.create({
            data: {
              tenantId,
              invitedByUserId: actorUserId || user.id,
              email: user.email,
              roleName: role as string,
              currentRoleName: user.role,
              type: 'role_change',
              status: 'pending',
              tokenHash,
              expiresAt,
            },
          });
        }

        const baseUrl = process.env['FRONTEND_URL'] || 'http://localhost:5173';
        const inviteLink = `${baseUrl}/invite/review?token=${rawToken}`;

        await this.emailService.sendInvitationEmail({
          to: user.email,
          tenantId,
          type: 'role_change',
          currentRoleName: user.role,
          roleName: role,
          tenantName,
          inviteLink,
          inviterName: 'Practice Admin',
        });
      } catch (err) {
        console.error('[UserService] Failed to send role update notification email:', err);
      }
    }

    if (this.publisher) {
      await this.publisher.publish({
        eventType: role !== undefined ? 'auth.role.updated' : 'user.updated',
        occurredAt: new Date(),
        requestId: '',
        tenantId,
        userId: id,
        actorUserId: actorUserId || id,
        previousRole: user.role,
        newRole: role || user.role,
      });
    }

    return updatedUser;
  }

  /**
   * Transfer practice ownership to another active staff member
   * Fully transactional and audited.
   */
  public async transferOwnership(params: { tenantId: string; actorUserId: string; targetUserId: string }): Promise<User> {
    const { tenantId, actorUserId, targetUserId } = params;

    if (this.prisma) {
      return await this.prisma.$transaction(async (tx) => {
        const targetUser = await tx.user.findFirst({
          where: { id: targetUserId, tenantId, status: 'active', deletedAt: null },
        });

        if (!targetUser) {
          throw new Error('Target user not found or is inactive/archived.');
        }

        // Promote target user to clinic_owner
        const updatedTarget = await tx.user.update({
          where: { id: targetUserId },
          data: {
            role: 'clinic_owner',
            tokenVersion: { increment: 1 },
          },
        });

        // Sync user_roles table
        if (this.rbacBootstrapService) {
          await this.rbacBootstrapService.assignSystemRoleToUser({
            userId: targetUserId,
            tenantId,
            roleName: 'clinic_owner',
          });
        }

        if (this.emailService) {
          try {
            const tenant = await tx.tenant.findUnique({ where: { id: tenantId } });
            await this.emailService.sendOwnershipTransferredEmail({
              to: targetUser.email,
              newOwnerName: `${targetUser.firstName} ${targetUser.lastName}`.trim(),
              tenantName: tenant?.name || 'Practice',
              tenantId,
            });
          } catch (err) {
            console.error('[UserService] Failed to send ownership transfer email:', err);
          }
        }

        if (this.publisher) {
          await this.publisher.publish({
            eventType: 'auth.ownership.transferred',
            occurredAt: new Date(),
            requestId: '',
            tenantId,
            actorUserId,
            targetUserId,
          });
        }

        return updatedTarget;
      }, { timeout: 20000 });
    }

    // Fallback if prisma context not injected
    return await this.updateUser({
      id: targetUserId,
      tenantId,
      role: 'clinic_owner',
      actorUserId,
    });
  }

  /**
   * Suspend a user (sets status = 'suspended').
   * Sole-owner protection applies — cannot suspend the last active owner.
   */
  public async suspendUser(
    id: string,
    tenantId: string,
    actorUserId: string,
  ): Promise<User> {
    const user = await this.userRepository.findById(id);
    if (!user) throw new Error('User not found');
    if (user.tenantId !== tenantId) throw new Error('Tenant isolation violation');
    if (user.id === actorUserId) throw new Error('You cannot suspend your own account.');
    if (user.status === 'suspended') throw new Error('User is already suspended.');

    // Sole-owner protection
    const isOwner = user.role === 'clinic_owner' || user.role === 'admin';
    if (isOwner) {
      const activeOwners = await this.countActiveOwners(tenantId);
      if (activeOwners <= 1) throw new SoleOwnerProtectionError();
    }

    const updated = await this.userRepository.update(id, {
      status: 'suspended',
      tokenVersion: (user.tokenVersion || 0) + 1,  // invalidate all tokens
    });

    // Revoke all active sessions
    if (this.prisma) {
      await this.prisma.session
        .updateMany({
          where: { userId: id, status: 'active' },
          data: { status: 'revoked' },
        })
        .catch(() => {});
    }

    if (this.publisher) {
      await this.publisher.publish({
        eventType: 'user.suspended',
        occurredAt: new Date(),
        requestId: '',
        tenantId,
        userId: id,
        actorUserId,
      });
    }

    return updated;
  }

  /**
   * Reactivate a suspended user.
   */
  public async reactivateUser(
    id: string,
    tenantId: string,
    actorUserId: string,
  ): Promise<User> {
    const user = await this.userRepository.findById(id);
    if (!user) throw new Error('User not found');
    if (user.tenantId !== tenantId) throw new Error('Tenant isolation violation');
    if (user.status === 'active') throw new Error('User is already active.');

    const updated = await this.userRepository.update(id, { status: 'active' });

    if (this.publisher) {
      await this.publisher.publish({
        eventType: 'user.reactivated',
        occurredAt: new Date(),
        requestId: '',
        tenantId,
        userId: id,
        actorUserId,
      });
    }

    return updated;
  }

  /**
   * Force logout — increments tokenVersion (invalidates all JWT access tokens)
   * and revokes all active sessions in the database.
   */
  public async forceLogout(
    id: string,
    tenantId: string,
    actorUserId: string,
  ): Promise<{ sessionsRevoked: number }> {
    const user = await this.userRepository.findById(id);
    if (!user) throw new Error('User not found');
    if (user.tenantId !== tenantId) throw new Error('Tenant isolation violation');

    // Increment tokenVersion to invalidate all outstanding JWT access tokens
    await this.userRepository.update(id, {
      tokenVersion: (user.tokenVersion || 0) + 1,
    });

    // Revoke all active sessions
    let sessionsRevoked = 0;
    if (this.prisma) {
      const result = await this.prisma.session
        .updateMany({
          where: { userId: id, status: 'active' },
          data: { status: 'revoked' },
        })
        .catch(() => ({ count: 0 }));
      sessionsRevoked = result.count;
    }

    if (this.publisher) {
      await this.publisher.publish({
        eventType: 'auth.force_logout',
        occurredAt: new Date(),
        requestId: '',
        tenantId,
        userId: id,
        actorUserId,
        sessionsRevoked,
      });
    }

    return { sessionsRevoked };
  }

  public async getUserById(id: string, tenantId: string): Promise<User> {
    const user = await this.userRepository.findById(id);
    if (!user) {
      throw new Error('User not found');
    }
    if (user.tenantId !== tenantId) {
      throw new Error('Tenant isolation violation');
    }
    return user;
  }

  public async listUsers(params: {
    tenantId: string;
    limit?: number;
    offset?: number;
    search?: string;
    role?: string;
    status?: string;
  }): Promise<User[]> {
    return this.userRepository.findMany(params);
  }

  public async revokeUser(
    id: string,
    tenantId: string,
    actorUserId: string,
    reason: string,
  ): Promise<User> {
    const trimmedReason = (reason || '').trim();
    if (!trimmedReason) {
      const err: any = new Error('Revocation reason is required.');
      err.statusCode = 400;
      err.code = 'MISSING_REASON';
      throw err;
    }
    if (trimmedReason.length > 500) {
      const err: any = new Error('Revocation reason cannot exceed 500 characters.');
      err.statusCode = 400;
      err.code = 'INVALID_REASON';
      throw err;
    }

    const user = await this.userRepository.findById(id);
    if (!user) {
      const err: any = new Error('User not found');
      err.statusCode = 404;
      err.code = 'USER_NOT_FOUND';
      throw err;
    }
    if (user.tenantId !== tenantId) {
      const err: any = new Error('Tenant isolation violation');
      err.statusCode = 403;
      err.code = 'TENANT_ISOLATION_VIOLATION';
      throw err;
    }
    if (actorUserId && user.id === actorUserId) {
      const err: any = new Error('You cannot delete your own account.');
      err.statusCode = 400;
      err.code = 'CANNOT_DELETE_SELF';
      throw err;
    }

    // ── LAST OWNER PROTECTION GUARD ──
    const isOwner = user.role === 'clinic_owner' || user.role === 'admin' || user.role === 'tenant_owner';
    if (isOwner) {
      const activeOwners = await this.countActiveOwners(tenantId);
      if (activeOwners <= 1) {
        throw new SoleOwnerProtectionError();
      }
    }

    const revokedAt = new Date();

    // 1. Fetch revoker and tenant information for audit and notification
    let revokerName = 'Practice Administrator';
    let tenantName = 'Practice';
    let timezone = 'UTC';

    if (this.prisma) {
      const [actorUser, tenant] = await Promise.all([
        actorUserId ? this.prisma.user.findUnique({ where: { id: actorUserId } }) : null,
        this.prisma.tenant.findUnique({ where: { id: tenantId } }),
      ]);

      if (actorUser) {
        revokerName = `${actorUser.firstName ?? ''} ${actorUser.lastName ?? ''}`.trim() || actorUser.email || 'Practice Owner';
      }
      if (tenant) {
        tenantName = tenant.name || 'Practice';
        timezone = tenant.timezone || 'UTC';
      }
    }

    // 2. Perform atomic user update
    const revoked = await this.userRepository.update(id, {
      deletedAt: revokedAt,
      status: 'archived',
      revokedAt,
      revokedByUserId: actorUserId,
      revocationReason: trimmedReason,
      tokenVersion: (user.tokenVersion || 0) + 1,
    });

    // 3. Invalidate caches immediately
    UserRepository.invalidateRelationCache(id);

    // 4. Revoke all active sessions & user roles, deactivate doctor profile, record audit log
    if (this.prisma) {
      await Promise.all([
        // Revoke active sessions
        this.prisma.session.updateMany({
          where: { userId: id, status: 'active' },
          data: { status: 'revoked' },
        }).catch(() => {}),

        // Update user_roles join entries
        this.prisma.userRole.updateMany({
          where: { userId: id, isActive: true },
          data: { revokedAt, isActive: false },
        }).catch(() => {}),

        // If the user was a doctor in this tenant, deactivate doctor record
        user.email
          ? this.prisma.doctor.updateMany({
              where: {
                tenantId,
                email: normalizeEmail(user.email),
                deletedAt: null,
              },
              data: {
                status: 'inactive',
                deletedAt: revokedAt,
              },
            }).catch(() => {})
          : Promise.resolve(),

        // Immutable Audit Log
        this.prisma.rbacAuditLog.create({
          data: {
            tenantId,
            clinicId: user.clinicId || null,
            userId: id,
            actorId: actorUserId || null,
            eventType: 'membership.access_revoked',
            resource: 'user',
            permission: 'users.manage',
            roleName: user.role,
            outcome: 'revoked',
            metadata: {
              revokedAt: revokedAt.toISOString(),
              revokedByUserId: actorUserId,
              revokerName,
              revocationReason: trimmedReason,
              userEmail: user.email,
              userName: `${user.firstName} ${user.lastName}`.trim(),
              role: user.role,
              tenantName,
            },
            occurredAt: revokedAt,
          },
        }).catch((err) => {
          console.error('[UserService] Failed to write RbacAuditLog:', err);
        }),
      ]);
    }

    // 5. Idempotent Email Notification
    if (this.emailService) {
      try {
        const idempotencyKey = `access_revoked:${tenantId}:${user.id}:${revokedAt.toISOString()}`;
        await this.emailService.sendAccessRevokedEmail({
          idempotencyKey,
          to: user.email,
          recipientName: `${user.firstName} ${user.lastName}`.trim(),
          roleName: user.role,
          tenantName,
          clinicName: tenantName,
          revokerName,
          revokedAt,
          reason: trimmedReason,
          tenantId,
          clinicId: user.clinicId || undefined,
          timezone,
        });
      } catch (err) {
        console.error('[UserService] Failed to send access revocation email:', err);
      }
    }

    // 6. Publish events
    if (this.publisher) {
      await Promise.all([
        this.publisher.publish({
          eventType: 'user.revoked',
          occurredAt: revokedAt,
          requestId: '',
          tenantId,
          userId: id,
          actorUserId: actorUserId || id,
        }).catch(() => {}),
        this.publisher.publish({
          eventType: 'user.deleted',
          occurredAt: revokedAt,
          requestId: '',
          tenantId,
          userId: id,
          actorUserId: actorUserId || id,
        }).catch(() => {}),
      ]);
    }

    return revoked;
  }

  public async deleteUser(
    id: string,
    tenantId: string,
    actorUserId?: string,
    reason?: string,
  ): Promise<User> {
    const finalReason = reason && reason.trim() ? reason.trim() : 'Account access removed by clinic administrator.';
    return this.revokeUser(id, tenantId, actorUserId || '', finalReason);
  }

  public async restoreUser(id: string, tenantId: string): Promise<User> {
    const user = await this.userRepository.findByIdWithRelations(id);
    if (!user) {
      throw new Error('User not found');
    }
    if (user.tenantId !== tenantId) {
      throw new Error('Tenant isolation violation');
    }

    const restored = await this.userRepository.restore(id);

    if (this.publisher) {
      await this.publisher.publish({
        eventType: 'user.restored',
        occurredAt: new Date(),
        requestId: '',
        tenantId,
        userId: id,
      });
    }

    return restored;
  }
}

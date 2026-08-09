import * as crypto from 'crypto';
import * as argon2 from 'argon2';
import { PrismaClient } from '@prisma/client';
import {
  ARGON2_MEMORY_COST,
  ARGON2_PARALLELISM,
  ARGON2_TIME_COST,
} from '../constants/auth.constants';
import { isValidCustomerRole } from '../../rbac/constants/role-config.constants';
import {
  InvitationAlreadyMemberError,
  InvitationAlreadyRegisteredError,
  InvitationPendingExistsError,
  InvitationAlreadyAcceptedError,
  InvitationRevokedError,
  InvitationExpiredError,
  InvitationInvalidTokenError,
  InvitationInvalidRoleError,
  InvitationActorInactiveError,
} from '../errors/auth.errors';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CreateInvitationParams {
  tenantId: string;
  invitedByUserId: string;
  email: string;
  roleName: string;
  phone?: string;
  notes?: string;
}

export interface AcceptInvitationParams {
  token: string;
  password?: string;
  firstName?: string;
  lastName?: string;
}

export interface ListInvitationsParams {
  tenantId: string;
  status?: string;       // 'pending' | 'accepted' | 'expired' | 'revoked' | 'all'
  page?: number;
  limit?: number;
}

export interface InvitationStats {
  total: number;
  pending: number;
  accepted: number;
  expired: number;
  revoked: number;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class InvitationService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly rbacBootstrapService?: any,
    /**
     * Event publisher for audit trail.
     * Must expose a `.publish(event)` method compatible with AuthEventPublisher.
     * Audit failures are fire-and-forget — they MUST NOT abort the main flow.
     */
    private readonly eventPublisher?: any,
    private readonly emailProvider?: any,
  ) {}

  /**
   * Build the invitation link based on invitation type.
   */
  private buildInviteLink(rawToken: string, type: string): string {
    const baseUrl = process.env['FRONTEND_URL'] || 'http://localhost:5173';
    if (type === 'new_user') {
      return `${baseUrl}/invite/accept?token=${rawToken}`;
    }
    return `${baseUrl}/invite/review?token=${rawToken}`;
  }

  /**
   * Create a single-use, tenant-scoped invitation.
   * Handles Flow A (new user) vs Flow B (existing user role assignment/change).
   */
  public async createInvitation(params: CreateInvitationParams) {
    const { tenantId, invitedByUserId, email, roleName } = params;
    const normalizedEmail = email.toLowerCase().trim();

    // 1. Validate role is strictly one of the 3 customer roles
    if (!isValidCustomerRole(roleName)) {
      throw new InvitationInvalidRoleError(roleName);
    }

    // 2. Validate actor exists and is active
    const actor = await this.prisma.user.findFirst({
      where: { id: invitedByUserId, tenantId, deletedAt: null },
    });
    if (!actor || actor.status !== 'active') {
      throw new InvitationActorInactiveError();
    }

    // 3. Determine invitation type based on existing user account status
    const existingUser = await this.prisma.user.findFirst({
      where: { email: normalizedEmail, deletedAt: null },
    });

    let type = 'new_user';
    let currentRoleName: string | null = null;

    if (existingUser) {
      currentRoleName = existingUser.role;
      if (existingUser.tenantId === tenantId) {
        if (existingUser.role === roleName) {
          throw new InvitationAlreadyMemberError(normalizedEmail);
        }
        type = 'role_change';
      } else {
        type = 'role_assignment';
      }
    }

    // 4. Check if a pending/viewed invitation already exists for this email
    const existingPendingInvite = await this.prisma.invitation.findFirst({
      where: {
        tenantId,
        email: normalizedEmail,
        status: { in: ['pending', 'viewed'] },
      },
    });
    if (existingPendingInvite) {
      throw new InvitationPendingExistsError(normalizedEmail);
    }

    // 5. Generate 256-bit cryptographically secure token
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    // Token expires in 7 days
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    // 6. Store invitation in database
    const invitation = await this.prisma.invitation.create({
      data: {
        tenantId,
        email: normalizedEmail,
        type,
        currentRoleName,
        roleName,
        tokenHash,
        invitedByUserId,
        status: 'pending',
        expiresAt,
      },
      include: {
        tenant: true,
        invitedBy: { select: { firstName: true, lastName: true } },
      },
    });

    const inviteLink = this.buildInviteLink(rawToken, type);

    // 7. Audit Logging (fire-and-forget)
    if (this.eventPublisher) {
      this.eventPublisher.publish({
        eventType: 'auth.invitation.created',
        occurredAt: new Date(),
        requestId: invitation.id,
        tenantId,
        userId: invitedByUserId,
        ipAddress: 'system',
        metadata: { invitationId: invitation.id, roleName, type, currentRoleName },
      }).catch(() => {});
    }

    // 8. Send Invitation Email
    if (this.emailProvider && typeof this.emailProvider.sendInvitationEmail === 'function') {
      try {
        await this.emailProvider.sendInvitationEmail({
          idempotencyKey: `invitation:${invitation.id}`,
          to: normalizedEmail,
          tenantId,
          type,
          currentRoleName: currentRoleName || undefined,
          roleName,
          tenantName: invitation.tenant?.name || 'Practice',
          inviteLink,
          inviterName: invitation.invitedBy
            ? `${(invitation.invitedBy as any).firstName} ${(invitation.invitedBy as any).lastName}`.trim()
            : 'A team member',
        });
      } catch (err) {
        console.error('[InvitationService] Email dispatch failed for invitation:', err);
        console.info(
          `[InvitationService] 📧 INVITE LINK (${type}):\n  ${inviteLink}`,
        );
      }
    } else {
      console.info(
        `[InvitationService] 📧 INVITE LINK (${type}):\n  ${inviteLink}`,
      );
    }

    return {
      invitation: {
        id: invitation.id,
        email: invitation.email,
        type: invitation.type,
        currentRoleName: invitation.currentRoleName,
        roleName: invitation.roleName,
        status: invitation.status,
        expiresAt: invitation.expiresAt,
        createdAt: invitation.createdAt,
        tenantName: invitation.tenant?.name || 'Practice',
      },
      rawToken,
      inviteLink,
    };
  }

  /**
   * Resend an existing invitation — regenerates token, resets expiry.
   */
  public async resendInvitation(
    id: string,
    tenantId: string,
    actorUserId: string,
  ) {
    const invitation = await this.prisma.invitation.findFirst({
      where: { id, tenantId },
      include: {
        tenant: true,
        invitedBy: { select: { firstName: true, lastName: true } },
      },
    });

    if (!invitation) {
      throw new Error('Invitation not found.');
    }

    if (invitation.status !== 'pending' && invitation.status !== 'viewed' && invitation.status !== 'expired') {
      throw new Error(
        `Cannot resend invitation with status '${invitation.status}'. Only pending, viewed or expired invitations can be resent.`,
      );
    }

    // Generate fresh token
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const updated = await this.prisma.invitation.update({
      where: { id },
      data: {
        tokenHash,
        expiresAt,
        status: 'pending',
        resentAt: new Date(),
        updatedAt: new Date(),
      },
    });

    const inviteLink = this.buildInviteLink(rawToken, invitation.type);

    if (this.eventPublisher) {
      this.eventPublisher.publish({
        eventType: 'auth.invitation.resent',
        occurredAt: new Date(),
        requestId: id,
        tenantId,
        userId: actorUserId,
        ipAddress: 'system',
        metadata: { invitationId: id },
      }).catch(() => {});
    }

    if (this.emailProvider && typeof this.emailProvider.sendInvitationEmail === 'function') {
      try {
        await this.emailProvider.sendInvitationEmail({
          to: invitation.email,
          tenantId,
          type: invitation.type,
          currentRoleName: invitation.currentRoleName || undefined,
          roleName: invitation.roleName,
          tenantName: invitation.tenant?.name || 'Practice',
          inviteLink,
          inviterName: invitation.invitedBy
            ? `${(invitation.invitedBy as any).firstName} ${(invitation.invitedBy as any).lastName}`.trim()
            : 'A team member',
        });
      } catch (err) {
        console.error('[InvitationService] Email resend failed:', err);
        console.info(`[InvitationService] 📧 RESENT INVITE LINK:\n  ${inviteLink}`);
      }
    } else {
      console.info(`[InvitationService] 📧 RESENT INVITE LINK:\n  ${inviteLink}`);
    }

    return { invitation: updated, inviteLink };
  }

  /**
   * Validate invitation token and return safe metadata for accept/review form.
   */
  public async validateInvitationToken(rawToken: string) {
    if (!rawToken) {
      throw new InvitationInvalidTokenError('Invitation token is required.');
    }

    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    const invitation = await this.prisma.invitation.findUnique({
      where: { tokenHash },
      include: {
        tenant: true,
        invitedBy: { select: { firstName: true, lastName: true } },
      },
    });

    if (!invitation) {
      throw new InvitationInvalidTokenError('Invalid invitation token.');
    }

    if (invitation.status === 'revoked') {
      throw new InvitationRevokedError();
    }

    if (invitation.status === 'accepted') {
      throw new InvitationAlreadyAcceptedError();
    }

    if (invitation.status === 'declined') {
      throw new InvitationInvalidTokenError('This invitation has already been declined.');
    }

    if (invitation.expiresAt < new Date()) {
      if (invitation.status === 'pending' || invitation.status === 'viewed') {
        await this.prisma.invitation
          .update({
            where: { id: invitation.id },
            data: { status: 'expired' },
          })
          .catch(() => {});
      }
      throw new InvitationExpiredError();
    }

    // Mark viewed if currently pending
    if (invitation.status === 'pending') {
      await this.prisma.invitation.update({
        where: { id: invitation.id },
        data: { status: 'viewed', viewedAt: new Date() },
      }).catch(() => {});
    }

    const existingUser = await this.prisma.user.findFirst({
      where: { email: invitation.email.toLowerCase().trim(), deletedAt: null },
    });

    const inviterName = invitation.invitedBy
      ? `${(invitation.invitedBy as any).firstName} ${(invitation.invitedBy as any).lastName}`.trim()
      : 'A team member';

    return {
      id: invitation.id,
      tenantId: invitation.tenantId,
      tenantName: invitation.tenant.name,
      email: invitation.email,
      type: invitation.type,
      currentRoleName: invitation.currentRoleName,
      roleName: invitation.roleName,
      expiresAt: invitation.expiresAt,
      inviterName,
      isExistingUser: Boolean(existingUser),
    };
  }

  /**
   * Decline an invitation explicitly.
   */
  public async declineInvitation(rawToken: string, actorUserId?: string) {
    if (!rawToken) {
      throw new InvitationInvalidTokenError('Invitation token is required.');
    }

    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    const invitation = await this.prisma.invitation.findUnique({
      where: { tokenHash },
    });

    if (!invitation) {
      throw new InvitationInvalidTokenError('Invalid invitation token.');
    }

    if (invitation.status === 'accepted' || invitation.status === 'declined' || invitation.status === 'revoked') {
      throw new Error(`Invitation cannot be declined. Current status: ${invitation.status}.`);
    }

    const updated = await this.prisma.invitation.update({
      where: { id: invitation.id },
      data: {
        status: 'declined',
        declinedAt: new Date(),
      },
    });

    if (this.eventPublisher) {
      this.eventPublisher.publish({
        eventType: 'auth.invitation.declined',
        occurredAt: new Date(),
        requestId: invitation.id,
        tenantId: invitation.tenantId,
        userId: actorUserId || 'guest',
        ipAddress: 'system',
        metadata: { invitationId: invitation.id, roleName: invitation.roleName },
      }).catch(() => {});
    }

    return updated;
  }

  /**
   * Accept invitation and atomically create user or update role + assign RBAC.
   */
  public async acceptInvitation(params: AcceptInvitationParams) {
    const { token, password, firstName, lastName } = params;

    if (!token) {
      throw new InvitationInvalidTokenError('Invitation token is required.');
    }

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    let passwordHash: string | undefined;
    if (password) {
      passwordHash = await argon2.hash(password, {
        type: argon2.argon2id,
        memoryCost: ARGON2_MEMORY_COST,
        timeCost: ARGON2_TIME_COST,
        parallelism: ARGON2_PARALLELISM,
      });
    }

    return await this.prisma.$transaction(async (tx) => {
      const invitation = await tx.invitation.findUnique({
        where: { tokenHash },
        include: { tenant: true, invitedBy: true },
      });

      if (!invitation) {
        throw new InvitationInvalidTokenError('Invalid invitation token.');
      }
      if (invitation.status === 'revoked') {
        throw new InvitationRevokedError();
      }
      if (invitation.status === 'accepted') {
        throw new InvitationAlreadyAcceptedError();
      }
      if (invitation.status === 'declined') {
        throw new InvitationInvalidTokenError('This invitation has already been declined.');
      }
      if (invitation.status !== 'pending' && invitation.status !== 'viewed') {
        throw new InvitationInvalidTokenError(`Invitation cannot be accepted. Current status: ${invitation.status}.`);
      }
      if (invitation.expiresAt < new Date()) {
        await tx.invitation.update({
          where: { id: invitation.id },
          data: { status: 'expired' },
        });
        throw new InvitationExpiredError();
      }
      if (!invitation.tenant || invitation.tenant.status === 'suspended') {
        throw new Error('Practice tenant is inactive or suspended.');
      }

      const existingUser = await tx.user.findFirst({
        where: { email: invitation.email.toLowerCase().trim(), deletedAt: null },
      });

      // Flow A requires password creation for new accounts
      if (!existingUser && !passwordHash) {
        throw new Error('Password is required to set up a new account.');
      }

      // ATOMIC STATUS LOCK
      const lockResult = await tx.invitation.updateMany({
        where: { id: invitation.id, status: { in: ['pending', 'viewed'] } },
        data: {
          status: 'accepted',
          acceptedAt: new Date(),
          usedAt: new Date(),
        },
      });

      if (lockResult.count === 0) {
        throw new InvitationAlreadyAcceptedError();
      }

      let user: any;
      if (existingUser) {
        // Flow B — Existing User Role Assignment or Role Change
        user = await tx.user.update({
          where: { id: existingUser.id },
          data: {
            tenantId: invitation.tenantId,
            role: invitation.roleName,
            status: 'active',
            emailVerified: true,
          },
        });
      } else {
        // Flow A — New Account Creation
        user = await tx.user.create({
          data: {
            tenantId: invitation.tenantId,
            email: invitation.email.toLowerCase().trim(),
            passwordHash: passwordHash!,
            firstName: firstName || 'Team',
            lastName: lastName || 'Member',
            role: invitation.roleName,
            emailVerified: true,
            emailVerifiedAt: new Date(),
            status: 'active',
          },
        });
      }

      // Assign System Role to user_roles
      if (this.rbacBootstrapService) {
        await this.rbacBootstrapService.assignSystemRoleToUser({
          userId: user.id,
          tenantId: invitation.tenantId,
          roleName: invitation.roleName,
        });
      }

      // Audit Log
      if (this.eventPublisher) {
        this.eventPublisher.publish({
          eventType: 'auth.invitation.accepted',
          occurredAt: new Date(),
          requestId: invitation.id,
          tenantId: invitation.tenantId,
          userId: user.id,
          ipAddress: 'system',
          metadata: { invitationId: invitation.id, assignedRole: invitation.roleName, type: invitation.type },
        }).catch(() => {});
      }

      const { passwordHash: _, tokenVersion: __, ...safeUser } = user as any;
      return safeUser;
    });
  }

  /**
   * List invitations for a tenant with pagination and optional status filter.
   * Auto-expires stale pending invitations before returning.
   */
  public async listInvitations(params: ListInvitationsParams) {
    const { tenantId, status = 'pending', page = 1, limit = 20 } = params;
    const offset = (page - 1) * limit;

    // Auto-flag expired invitations
    const now = new Date();
    await this.prisma.invitation
      .updateMany({
        where: { tenantId, status: 'pending', expiresAt: { lt: now } },
        data: { status: 'expired' },
      })
      .catch(() => {});

    const whereStatus =
      status === 'all'
        ? {}
        : { status };

    const [invitations, total] = await Promise.all([
      this.prisma.invitation.findMany({
        where: { tenantId, ...whereStatus },
        select: {
          id: true,
          email: true,
          roleName: true,
          status: true,
          expiresAt: true,
          createdAt: true,
          updatedAt: true,
          usedAt: true,
          invitedBy: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.invitation.count({ where: { tenantId, ...whereStatus } }),
    ]);

    return { invitations, total, page, limit };
  }

  /**
   * Get invitation statistics for the tenant dashboard widget.
   */
  public async getInvitationStats(tenantId: string): Promise<InvitationStats> {
    const now = new Date();
    // Expire stale pending invitations
    await this.prisma.invitation
      .updateMany({
        where: { tenantId, status: 'pending', expiresAt: { lt: now } },
        data: { status: 'expired' },
      })
      .catch(() => {});

    const grouped = await this.prisma.invitation.groupBy({
      by: ['status'],
      where: { tenantId },
      _count: { _all: true },
    });

    const counts: Record<string, number> = {};
    for (const g of grouped) {
      counts[g.status] = g._count._all;
    }

    const total = Object.values(counts).reduce((s, n) => s + n, 0);
    return {
      total,
      pending: counts['pending'] ?? 0,
      accepted: counts['accepted'] ?? 0,
      expired: counts['expired'] ?? 0,
      revoked: counts['revoked'] ?? 0,
    };
  }

  /**
   * Revoke invitation (Immutable State Machine: only pending can be revoked).
   */
  public async revokeInvitation(id: string, tenantId: string, actorUserId: string) {
    const invitation = await this.prisma.invitation.findFirst({
      where: { id, tenantId },
    });

    if (!invitation) {
      throw new Error('Invitation not found.');
    }

    if (invitation.status !== 'pending') {
      throw new Error(`Cannot revoke invitation with status '${invitation.status}'.`);
    }

    const updated = await this.prisma.invitation.update({
      where: { id },
      data: { status: 'revoked' },
    });

    if (this.eventPublisher) {
      this.eventPublisher.publish({
        eventType: 'auth.invitation.revoked',
        occurredAt: new Date(),
        requestId: id,
        tenantId,
        userId: actorUserId,
        ipAddress: 'system',
        metadata: { invitationId: id },
      }).catch(() => {});
    }

    if (this.emailProvider && typeof (this.emailProvider as any).sendInvitationRevokedNotificationEmail === 'function') {
      (this.emailProvider as any).sendInvitationRevokedNotificationEmail({
        to: invitation.email,
        tenantName: 'Practice',
        tenantId,
      }).catch((err: any) => console.error('[InvitationService] Failed to send revoke email:', err));
    }

    return updated;
  }
}

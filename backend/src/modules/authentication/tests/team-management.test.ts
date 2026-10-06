import { InvitationService } from '../services/invitation.service';
import { UserService, SoleOwnerProtectionError } from '../services/user.service';
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
import { ConfigurationService } from '../../configuration/services/configuration.service';

describe('Team Management Enterprise IAM Module', () => {
  let mockPrisma: any;
  let invitationService: InvitationService;
  let userService: UserService;
  let configService: ConfigurationService;
  let mockConfigRepo: any;
  let mockCache: any;
  let mockPublisher: any;

  const tenantId = '00000000-0000-0000-0000-000000000001';
  const ownerUserId = '00000000-0000-0000-0000-000000000002';
  const newEmail = 'newdoctor@practice.com';

  beforeEach(() => {
    mockPrisma = {
      user: {
        findFirst: jest.fn(),
        findUnique: jest.fn().mockResolvedValue({ id: 'actor-1', firstName: 'Owner', lastName: 'Admin' }),
        findMany: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      invitation: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        groupBy: jest.fn(),
      },
      session: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      userRole: {
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      doctor: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'doc-1' }),
        update: jest.fn().mockResolvedValue({ id: 'doc-1' }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      clinic: {
        findFirst: jest.fn().mockResolvedValue({ id: 'clinic-1' }),
      },
      tenant: {
        findUnique: jest.fn().mockResolvedValue({ id: 'tenant-1', name: 'Test Practice' }),
      },
      rbacAuditLog: {
        create: jest.fn().mockResolvedValue({ id: 'audit-1' }),
      },
      $transaction: jest.fn((cb) => cb(mockPrisma)),
    };

    mockConfigRepo = {
      findActive: jest.fn(),
      create: jest.fn(),
    };

    mockCache = {
      get: jest.fn().mockReturnValue(null),
      set: jest.fn(),
    };

    mockPublisher = {
      publish: jest.fn().mockResolvedValue(true),
    };

    invitationService = new InvitationService(mockPrisma, null, null, null);
    userService = new UserService(
      {
        findById: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
      } as any,
      mockPublisher,
      mockPrisma,
      null,
    );
    configService = new ConfigurationService(mockConfigRepo, mockCache, mockPublisher);
  });

  describe('1. Invitation Creation & Role Enforcement', () => {
    it('should throw InvitationInvalidRoleError if role is invalid', async () => {
      await expect(
        invitationService.createInvitation({
          tenantId,
          invitedByUserId: ownerUserId,
          email: newEmail,
          roleName: 'super_admin_fake',
        }),
      ).rejects.toThrow(InvitationInvalidRoleError);
    });

    it('should throw InvitationActorInactiveError if inviter is inactive or deleted', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null); // actor not found
      await expect(
        invitationService.createInvitation({
          tenantId,
          invitedByUserId: ownerUserId,
          email: newEmail,
          roleName: 'doctor',
        }),
      ).rejects.toThrow(InvitationActorInactiveError);
    });

    it('should create invitation successfully when parameters are valid', async () => {
      mockPrisma.user.findFirst
        .mockResolvedValueOnce({ id: ownerUserId, status: 'active' }) // actor
        .mockResolvedValueOnce(null); // no existing user with email
      mockPrisma.invitation.findFirst.mockResolvedValue(null); // no pending invite
      mockPrisma.invitation.create.mockResolvedValue({
        id: 'inv-123',
        email: newEmail,
        roleName: 'doctor',
        status: 'pending',
        expiresAt: new Date(Date.now() + 7 * 86400 * 1000),
        createdAt: new Date(),
        tenant: { name: 'Dental Practice' },
        invitedBy: { firstName: 'Dr.', lastName: 'Owner' },
      });

      const result = await invitationService.createInvitation({
        tenantId,
        invitedByUserId: ownerUserId,
        email: newEmail,
        roleName: 'doctor',
      });

      expect(result.invitation.id).toBe('inv-123');
      expect(result.inviteLink).toContain('/invite/accept?token=');
    });
  });

  describe('2. Duplicate & Conflict Protections (409 Conflict)', () => {
    it('should throw InvitationAlreadyMemberError if email already has the same role in the practice', async () => {
      mockPrisma.user.findFirst
        .mockResolvedValueOnce({ id: ownerUserId, status: 'active' }) // actor
        .mockResolvedValueOnce({ id: 'u-99', tenantId, email: newEmail, role: 'doctor' }); // existing user in same tenant with same role

      await expect(
        invitationService.createInvitation({
          tenantId,
          invitedByUserId: ownerUserId,
          email: newEmail,
          roleName: 'doctor',
        }),
      ).rejects.toThrow(InvitationAlreadyMemberError);
    });

    it('should create role_assignment invitation if email is registered in another tenant', async () => {
      mockPrisma.user.findFirst
        .mockResolvedValueOnce({ id: ownerUserId, status: 'active' }) // actor
        .mockResolvedValueOnce({ id: 'u-99', tenantId: 'other-tenant-id', email: newEmail, role: 'receptionist' }); // existing user in other tenant

      mockPrisma.invitation.findFirst.mockResolvedValueOnce(null);
      mockPrisma.invitation.create.mockResolvedValueOnce({
        id: 'inv-other',
        tenantId,
        email: newEmail,
        type: 'role_assignment',
        roleName: 'doctor',
        tokenHash: 'hash-other',
        invitedByUserId: ownerUserId,
        status: 'pending',
        expiresAt: new Date(Date.now() + 86400000),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await invitationService.createInvitation({
        tenantId,
        invitedByUserId: ownerUserId,
        email: newEmail,
        roleName: 'doctor',
      });

      expect(result.invitation.type).toBe('role_assignment');
    });

    it('should throw InvitationPendingExistsError if pending invite already exists', async () => {
      mockPrisma.user.findFirst
        .mockResolvedValueOnce({ id: ownerUserId, status: 'active' }) // actor
        .mockResolvedValueOnce(null); // user does not exist yet

      mockPrisma.invitation.findFirst.mockResolvedValue({ id: 'inv-existing', status: 'pending' });

      await expect(
        invitationService.createInvitation({
          tenantId,
          invitedByUserId: ownerUserId,
          email: newEmail,
          roleName: 'doctor',
        }),
      ).rejects.toThrow(InvitationPendingExistsError);
    });
  });

  describe('3. Invitation Token Validation & Lifecycle', () => {
    it('should throw InvitationInvalidTokenError when token is missing or not found', async () => {
      mockPrisma.invitation.findUnique.mockResolvedValue(null);
      await expect(invitationService.validateInvitationToken('invalid-token')).rejects.toThrow(
        InvitationInvalidTokenError,
      );
    });

    it('should throw InvitationRevokedError if invitation was revoked', async () => {
      mockPrisma.invitation.findUnique.mockResolvedValue({
        status: 'revoked',
        expiresAt: new Date(Date.now() + 86400000),
      });
      await expect(invitationService.validateInvitationToken('revoked-token')).rejects.toThrow(
        InvitationRevokedError,
      );
    });

    it('should throw InvitationAlreadyAcceptedError if token was already used', async () => {
      mockPrisma.invitation.findUnique.mockResolvedValue({
        status: 'accepted',
        expiresAt: new Date(Date.now() + 86400000),
      });
      await expect(invitationService.validateInvitationToken('used-token')).rejects.toThrow(
        InvitationAlreadyAcceptedError,
      );
    });

    it('should throw InvitationExpiredError if invitation has expired', async () => {
      mockPrisma.invitation.findUnique.mockResolvedValue({
        id: 'inv-1',
        status: 'pending',
        expiresAt: new Date(Date.now() - 1000), // past
      });
      mockPrisma.invitation.update.mockResolvedValue({});
      await expect(invitationService.validateInvitationToken('expired-token')).rejects.toThrow(
        InvitationExpiredError,
      );
    });
  });

  describe('4. Atomic Invitation Acceptance & User Creation', () => {
    it('should atomically lock status and create user with ACTIVE status', async () => {
      const expiresAt = new Date(Date.now() + 86400000);
      mockPrisma.invitation.findUnique.mockResolvedValue({
        id: 'inv-123',
        tenantId,
        email: newEmail,
        roleName: 'doctor',
        status: 'pending',
        expiresAt,
        tenant: { name: 'Practice', status: 'active' },
        invitedBy: { status: 'active' },
      });
      mockPrisma.user.findFirst.mockResolvedValue(null); // no existing user
      mockPrisma.invitation.updateMany.mockResolvedValue({ count: 1 }); // atomic status lock success
      mockPrisma.user.create.mockResolvedValue({
        id: 'user-new',
        tenantId,
        email: newEmail,
        firstName: 'Dr. Jane',
        lastName: 'Smith',
        role: 'doctor',
        status: 'active',
        emailVerified: true,
      });

      const user = await invitationService.acceptInvitation({
        token: 'valid-raw-token',
        password: 'Password123!',
        firstName: 'Dr. Jane',
        lastName: 'Smith',
      });

      expect(user.id).toBe('user-new');
      expect(user.status).toBe('active');
      expect(mockPrisma.invitation.updateMany).toHaveBeenCalledWith({
        where: { id: 'inv-123', status: { in: ['pending', 'viewed'] } },
        data: expect.objectContaining({ status: 'accepted' }),
      });
    });

    it('should throw InvitationAlreadyAcceptedError if parallel concurrent request locked status first', async () => {
      const expiresAt = new Date(Date.now() + 86400000);
      mockPrisma.invitation.findUnique.mockResolvedValue({
        id: 'inv-123',
        tenantId,
        email: newEmail,
        roleName: 'doctor',
        status: 'pending',
        expiresAt,
        tenant: { name: 'Practice', status: 'active' },
        invitedBy: { status: 'active' },
      });
      mockPrisma.user.findFirst.mockResolvedValue(null);
      mockPrisma.invitation.updateMany.mockResolvedValue({ count: 0 }); // parallel request won race!

      await expect(
        invitationService.acceptInvitation({
          token: 'valid-raw-token',
          password: 'Password123!',
          firstName: 'Dr. Jane',
          lastName: 'Smith',
        }),
      ).rejects.toThrow(InvitationAlreadyAcceptedError);
    });
  });

  describe('5. Sole Owner Protection & Lifecycle Actions', () => {
    it('should prevent suspending sole practice owner', async () => {
      mockPrisma.user.count.mockResolvedValue(1); // only 1 owner active
      const userRepo = userService['userRepository'];
      (userRepo.findById as jest.Mock).mockResolvedValue({
        id: ownerUserId,
        tenantId,
        role: 'clinic_owner',
        status: 'active',
      });

      await expect(
        userService.suspendUser(ownerUserId, tenantId, 'actor-user-id'),
      ).rejects.toThrow(SoleOwnerProtectionError);
    });

    it('should prevent user from deleting their own account', async () => {
      const userRepo = userService['userRepository'];
      (userRepo.findById as jest.Mock).mockResolvedValue({
        id: ownerUserId,
        tenantId,
        role: 'clinic_owner',
        status: 'active',
      });

      await expect(
        userService.deleteUser(ownerUserId, tenantId, ownerUserId),
      ).rejects.toThrow('You cannot delete your own account.');
    });

    it('should prevent deleting sole practice owner', async () => {
      mockPrisma.user.count.mockResolvedValue(1); // only 1 owner active
      const userRepo = userService['userRepository'];
      (userRepo.findById as jest.Mock).mockResolvedValue({
        id: ownerUserId,
        tenantId,
        role: 'clinic_owner',
        status: 'active',
      });

      await expect(
        userService.deleteUser(ownerUserId, tenantId, 'other-actor-id'),
      ).rejects.toThrow(SoleOwnerProtectionError);
    });

    it('should successfully remove team member, revoke sessions, clear user_roles, and increment tokenVersion', async () => {
      const targetStaffId = 'staff-123';
      const userRepo = userService['userRepository'];
      (userRepo.findById as jest.Mock).mockResolvedValue({
        id: targetStaffId,
        tenantId,
        email: 'staff@example.com',
        role: 'doctor',
        status: 'active',
        tokenVersion: 2,
      });
      (userRepo.update as jest.Mock).mockResolvedValue({
        id: targetStaffId,
        tenantId,
        email: 'staff@example.com',
        role: 'doctor',
        status: 'archived',
        deletedAt: new Date(),
        tokenVersion: 3,
      });

      const result = await userService.deleteUser(targetStaffId, tenantId, ownerUserId);

      expect(result.status).toBe('archived');
      expect(userRepo.update).toHaveBeenCalledWith(targetStaffId, expect.objectContaining({
        status: 'archived',
        tokenVersion: 3,
      }));
      expect(mockPrisma.session.updateMany).toHaveBeenCalledWith({
        where: { userId: targetStaffId, status: 'active' },
        data: { status: 'revoked' },
      });
      expect(mockPrisma.userRole.updateMany).toHaveBeenCalledWith({
        where: { userId: targetStaffId, isActive: true },
        data: { revokedAt: expect.any(Date), isActive: false },
      });
    });
  });

  describe('6. Configurations API Auto-Seed (404 Resolution)', () => {
    it('should auto-seed default configuration when tenant has no configuration row in DB', async () => {
      mockConfigRepo.findActive.mockResolvedValue(null); // DB empty
      mockConfigRepo.create.mockResolvedValue({
        id: 'cfg-default',
        tenantId,
        clinicId: null,
        version: 1,
        isActive: true,
        business: { appointmentDuration: 30 },
        voice: { voiceModel: 'alloy' },
        ai: { provider: 'openai' },
        calendar: { calendarProvider: 'google' },
        notification: { smsEnabled: true, emailEnabled: true },
        branding: { clinicName: 'Practice' },
        localization: { timezone: 'UTC', language: 'en', country: 'US' },
        featureFlags: { aiEnabled: true, voiceEnabled: true },
        providers: { openai: {} },
      });

      const config = await configService.getActiveConfiguration(tenantId, null);

      expect(config.id).toBe('cfg-default');
      expect(mockConfigRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ tenantId, version: 1, isActive: true }),
      );
    });
  });
});

import { InvitationService } from '../services/invitation.service';

describe('Enterprise Team Invitation & Role Acceptance Workflow (Flow A vs Flow B)', () => {
  let mockPrisma: any;
  let mockEmailProvider: any;
  let mockEventPublisher: any;
  let mockRbacBootstrap: any;
  let service: InvitationService;

  const tenantId = '00000000-0000-0000-0000-000000000001';
  const ownerId = '00000000-0000-0000-0000-000000000002';

  beforeEach(() => {
    mockPrisma = {
      user: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      invitation: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      $transaction: jest.fn((cb) => cb(mockPrisma)),
    };

    mockEmailProvider = {
      sendInvitationEmail: jest.fn().mockResolvedValue(undefined),
    };

    mockEventPublisher = {
      publish: jest.fn().mockResolvedValue(undefined),
    };

    mockRbacBootstrap = {
      assignSystemRoleToUser: jest.fn().mockResolvedValue(undefined),
    };

    service = new InvitationService(mockPrisma, mockRbacBootstrap, mockEventPublisher, mockEmailProvider);
  });

  describe('1. Flow A: New User Onboarding Workflow', () => {
    it('should create new_user invitation and generate /invite/accept link for unregistered email', async () => {
      mockPrisma.user.findFirst
        .mockResolvedValueOnce({ id: ownerId, tenantId, status: 'active' }) // actor check
        .mockResolvedValueOnce(null); // existing user check -> null

      mockPrisma.invitation.findFirst.mockResolvedValueOnce(null); // pending invite check -> null
      mockPrisma.invitation.create.mockResolvedValueOnce({
        id: 'inv_101',
        tenantId,
        email: 'newuser@example.com',
        type: 'new_user',
        currentRoleName: null,
        roleName: 'doctor',
        tokenHash: 'hash_101',
        invitedByUserId: ownerId,
        status: 'pending',
        expiresAt: new Date(Date.now() + 7 * 86400000),
        createdAt: new Date(),
        tenant: { name: 'Dental AI Practice' },
        invitedBy: { firstName: 'Alice', lastName: 'Owner' },
      });

      const result = await service.createInvitation({
        tenantId,
        invitedByUserId: ownerId,
        email: 'newuser@example.com',
        roleName: 'doctor',
      });

      expect(result.invitation.type).toBe('new_user');
      expect(result.inviteLink).toContain('/invite/accept?token=');
      expect(mockEmailProvider.sendInvitationEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'newuser@example.com',
          type: 'new_user',
          roleName: 'doctor',
        }),
      );
    });
  });

  describe('2. Flow B: Existing User Role Assignment & Role Change Workflow', () => {
    it('should create role_change invitation for existing team member when role is updated', async () => {
      mockPrisma.user.findFirst
        .mockResolvedValueOnce({ id: ownerId, tenantId, status: 'active' }) // actor check
        .mockResolvedValueOnce({
          id: 'usr_201',
          tenantId,
          email: 'receptionist@example.com',
          role: 'receptionist',
          status: 'active',
        }); // existing user check

      mockPrisma.invitation.findFirst.mockResolvedValueOnce(null);
      mockPrisma.invitation.create.mockResolvedValueOnce({
        id: 'inv_102',
        tenantId,
        email: 'receptionist@example.com',
        type: 'role_change',
        currentRoleName: 'receptionist',
        roleName: 'doctor',
        tokenHash: 'hash_102',
        invitedByUserId: ownerId,
        status: 'pending',
        expiresAt: new Date(Date.now() + 7 * 86400000),
        createdAt: new Date(),
        tenant: { name: 'Dental AI Practice' },
        invitedBy: { firstName: 'Alice', lastName: 'Owner' },
      });

      const result = await service.createInvitation({
        tenantId,
        invitedByUserId: ownerId,
        email: 'receptionist@example.com',
        roleName: 'doctor',
      });

      expect(result.invitation.type).toBe('role_change');
      expect(result.invitation.currentRoleName).toBe('receptionist');
      expect(result.inviteLink).toContain('/invite/review?token=');
      expect(mockEmailProvider.sendInvitationEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'receptionist@example.com',
          type: 'role_change',
          currentRoleName: 'receptionist',
          roleName: 'doctor',
        }),
      );
    });

    it('should mark invitation as declined and keep previous role unchanged when user declines', async () => {
      const rawToken = 'decline_token_123';
      const tokenHash = require('crypto').createHash('sha256').update(rawToken).digest('hex');

      mockPrisma.invitation.findUnique.mockResolvedValueOnce({
        id: 'inv_102',
        tokenHash,
        status: 'pending',
        tenantId,
        roleName: 'doctor',
      });

      mockPrisma.invitation.update.mockResolvedValueOnce({
        id: 'inv_102',
        status: 'declined',
        declinedAt: new Date(),
      });

      const updated = await service.declineInvitation(rawToken, 'usr_201');

      expect(updated.status).toBe('declined');
      expect(mockPrisma.invitation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'inv_102' },
          data: expect.objectContaining({ status: 'declined' }),
        }),
      );
      expect(mockEventPublisher.publish).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: 'auth.invitation.declined' }),
      );
    });

    it('should update role atomically when user accepts role change invitation', async () => {
      const rawToken = 'accept_token_456';
      const tokenHash = require('crypto').createHash('sha256').update(rawToken).digest('hex');

      mockPrisma.invitation.findUnique.mockResolvedValueOnce({
        id: 'inv_102',
        tokenHash,
        status: 'pending',
        tenantId,
        email: 'receptionist@example.com',
        roleName: 'doctor',
        type: 'role_change',
        tenant: { status: 'active' },
        invitedBy: { status: 'active' },
      });

      mockPrisma.user.findFirst.mockResolvedValueOnce({
        id: 'usr_201',
        tenantId,
        email: 'receptionist@example.com',
        role: 'receptionist',
        status: 'active',
      });

      mockPrisma.invitation.updateMany.mockResolvedValueOnce({ count: 1 });

      mockPrisma.user.update.mockResolvedValueOnce({
        id: 'usr_201',
        tenantId,
        email: 'receptionist@example.com',
        role: 'doctor',
        status: 'active',
      });

      const acceptedUser = await service.acceptInvitation({ token: rawToken, password: '' });

      expect(acceptedUser.role).toBe('doctor');
      expect(mockRbacBootstrap.assignSystemRoleToUser).toHaveBeenCalledWith({
        userId: 'usr_201',
        tenantId,
        roleName: 'doctor',
      });
      expect(mockEventPublisher.publish).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: 'auth.invitation.accepted' }),
      );
    });
  });
});

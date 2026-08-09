import express, { type Application } from 'express';
import request from 'supertest';
import { InvitationController } from '../controllers/invitation.controller';
import { createInvitationRoutes } from '../routes/invitation.routes';

const mockInvitationService = {
  createInvitation: jest.fn(),
  validateInvitationToken: jest.fn(),
  acceptInvitation: jest.fn(),
  listInvitations: jest.fn(),
  revokeInvitation: jest.fn(),
};

function createTestApp(): Application {
  const app = express();
  app.use(express.json());

  // 1. Mock Request Context Middleware
  app.use((req, res, next) => {
    req.requestId = 'req-test-123';
    (req as any).context = {
      requestId: 'req-test-123',
      user: null,
      tenantId: null,
      clinicId: null,
      roles: [],
      permissions: new Set(),
      timestamp: new Date(),
      ip: '127.0.0.1',
      userAgent: 'test-agent',
    };
    next();
  });

  // 2. Mock Authenticate Middleware (simulates valid JWT sub, tenantId, role)
  const mockAuthenticate = (req: any, _res: any, next: any) => {
    req.user = {
      userId: 'user-owner-123',
      tenantId: 'tenant-dental-456',
      clinicId: 'clinic-main-789',
      role: 'clinic_owner',
      sessionId: 'session-abc-123',
      tokenVersion: 1,
      email: 'owner@practice.com',
    };
    if (req.context) {
      req.context.user = req.user;
      req.context.tenantId = req.user.tenantId;
      req.context.roles = [req.user.role];
    }
    next();
  };

  // 3. Mock Tenant Resolution Middleware
  const mockResolveTenant = (req: any, _res: any, next: any) => {
    req.tenantId = req.user?.tenantId || 'tenant-dental-456';
    if (req.context) {
      req.context.tenantId = req.tenantId;
    }
    next();
  };

  // 4. Mock Authorize Middleware
  const mockAuthorize = {
    requirePermission: (_perm: string) => (_req: any, _res: any, next: any) => next(),
  };

  const controller = new InvitationController(mockInvitationService as any);
  const router = createInvitationRoutes({
    controller,
    authenticate: mockAuthenticate,
    resolveTenant: mockResolveTenant,
    authorize: mockAuthorize,
  });

  app.use('/api/v1/invitations', router);
  return app;
}

describe('Invitation API Context & Request Lifecycle Integration Tests', () => {
  let app: Application;

  beforeEach(() => {
    jest.clearAllMocks();
    app = createTestApp();
  });

  describe('POST /api/v1/invitations', () => {
    it('successfully creates invitation with valid JWT user & tenant context without MISSING_CONTEXT error', async () => {
      mockInvitationService.createInvitation.mockResolvedValueOnce({
        invitation: {
          id: 'inv-123',
          email: 'doctor@practice.com',
          roleName: 'doctor',
          expiresAt: new Date('2030-01-01'),
        },
        rawToken: 'raw-crypto-token-123',
      });

      const res = await request(app)
        .post('/api/v1/invitations')
        .send({
          email: 'doctor@practice.com',
          roleName: 'doctor',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.invitationId).toBe('inv-123');
      expect(mockInvitationService.createInvitation).toHaveBeenCalledWith({
        tenantId: 'tenant-dental-456',
        invitedByUserId: 'user-owner-123',
        email: 'doctor@practice.com',
        roleName: 'doctor',
      });
    });

    it('returns 422 if invalid roleName is supplied', async () => {
      const res = await request(app)
        .post('/api/v1/invitations')
        .send({
          email: 'staff@practice.com',
          roleName: 'invalid_role',
        });

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('VALIDATION_FAILED');
    });
  });

  describe('GET /api/v1/invitations', () => {
    it('successfully lists pending invitations for tenant context', async () => {
      mockInvitationService.listInvitations.mockResolvedValueOnce([
        {
          id: 'inv-100',
          email: 'receptionist@practice.com',
          roleName: 'receptionist',
          status: 'pending',
          expiresAt: new Date('2030-01-01'),
          createdAt: new Date(),
        },
      ]);

      const res = await request(app).get('/api/v1/invitations');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
      expect(mockInvitationService.listInvitations).toHaveBeenCalledWith(expect.anything());
    });
  });

  describe('DELETE /api/v1/invitations/:id', () => {
    it('successfully revokes invitation with tenant and actor user context', async () => {
      mockInvitationService.revokeInvitation.mockResolvedValueOnce({ status: 'revoked' });

      const res = await request(app).delete('/api/v1/invitations/inv-100');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.revoked).toBe(true);
      expect(mockInvitationService.revokeInvitation).toHaveBeenCalledWith(
        'inv-100',
        'tenant-dental-456',
        'user-owner-123'
      );
    });
  });
});

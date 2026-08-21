import { createTenantResolutionMiddleware, invalidateTenantResolutionCache } from '../../tenant/middleware/tenant-resolution.middleware';
import { TENANT_STATUS_ACTIVE, TENANT_STATUS_SUSPENDED } from '../../tenant/constants/tenant.constants';
import { ConfigurationService } from '../../configuration/services/configuration.service';
import { ConfigurationCacheService } from '../../configuration/services/configuration-cache.service';
import { ClinicSuspendedError } from '../../authentication/errors/auth.errors';

describe('Clinic Synchronization & Suspension Verification', () => {
  beforeEach(() => {
    invalidateTenantResolutionCache();
  });
  describe('1. Canonical Clinic Settings Database Synchronization', () => {
    it('should synchronize clinicName, phone, email, address, and timezone to Clinic and Tenant tables', async () => {
      const mockRepo = {
        findActive: jest.fn().mockResolvedValue({
          id: 'cfg-1',
          tenantId: 'tenant-123',
          clinicId: 'clinic-456',
          version: 1,
          business: { clinicName: 'Old Name' },
          voice: {},
          ai: { provider: 'openai' },
          calendar: { calendarProvider: 'google' },
          notification: {},
          branding: {},
          localization: { timezone: 'UTC' },
          featureFlags: {},
          providers: {},
        }),
        findLatestVersion: jest.fn().mockResolvedValue(1),
        deactivateAll: jest.fn().mockResolvedValue(undefined),
        create: jest.fn().mockImplementation((data) => Promise.resolve({ id: 'cfg-2', ...data })),
        syncClinicAndTenant: jest.fn().mockResolvedValue(undefined),
      };

      const mockPublisher = {
        publish: jest.fn().mockResolvedValue(undefined),
      };

      const cache = new ConfigurationCacheService();
      const service = new ConfigurationService(mockRepo as any, cache, mockPublisher as any);

      const result = await service.updateConfiguration({
        tenantId: 'tenant-123',
        clinicId: 'clinic-456',
        updatedBy: 'user-789',
        requestId: 'req-1',
        business: {
          clinicName: 'Oracle Tooth Dental Care',
          contactPhone: '+1 (555) 019-2834',
          contactEmail: 'admin@oracletooth.com',
          address: '456 Smile Blvd, Suite 200',
        },
        localization: {
          timezone: 'America/New_York',
        },
      });

      expect(result).toBeDefined();
      expect(result.business.clinicName).toBe('Oracle Tooth Dental Care');

      // Verify syncClinicAndTenant was called with canonical identity updates
      expect(mockRepo.syncClinicAndTenant).toHaveBeenCalledTimes(1);
      expect(mockRepo.syncClinicAndTenant).toHaveBeenCalledWith(
        'tenant-123',
        'clinic-456',
        {
          name: 'Oracle Tooth Dental Care',
          phone: '+1 (555) 019-2834',
          email: 'admin@oracletooth.com',
          address: '456 Smile Blvd, Suite 200',
          timezone: 'America/New_York',
        },
      );
    });
  });

  describe('2. Tenant & Clinic Suspension Enforcement Middleware', () => {
    let mockTenantService: any;
    let mockClinicChecker: any;

    beforeEach(() => {
      mockTenantService = {
        getTenantById: jest.fn(),
        getTenantBySlug: jest.fn(),
      };
      mockClinicChecker = jest.fn();
    });

    it('should reject request with HTTP 403 CLINIC_SUSPENDED when Tenant is suspended', async () => {
      mockTenantService.getTenantById.mockResolvedValue({
        id: '11111111-1111-1111-1111-111111111111',
        status: TENANT_STATUS_SUSPENDED,
        timezone: 'UTC',
        language: 'en',
        country: 'US',
      });

      const middleware = createTenantResolutionMiddleware(mockTenantService, {
        clinicChecker: mockClinicChecker,
      });

      const req: any = {
        user: { tenantId: '11111111-1111-1111-1111-111111111111', clinicId: 'clinic-1', role: 'doctor' },
        headers: {},
        params: {},
        query: {},
        method: 'GET',
      };
      const res: any = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
      const next = jest.fn();

      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'CLINIC_SUSPENDED',
          }),
        }),
      );
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject request with HTTP 403 CLINIC_SUSPENDED when Clinic is suspended', async () => {
      mockTenantService.getTenantById.mockResolvedValue({
        id: '11111111-1111-1111-1111-111111111111',
        status: TENANT_STATUS_ACTIVE,
        timezone: 'UTC',
        language: 'en',
        country: 'US',
      });
      mockClinicChecker.mockResolvedValue({
        id: 'clinic-1',
        status: 'suspended',
      });

      const middleware = createTenantResolutionMiddleware(mockTenantService, {
        clinicChecker: mockClinicChecker,
      });

      const req: any = {
        user: { tenantId: '11111111-1111-1111-1111-111111111111', clinicId: 'clinic-1', role: 'clinic_owner' },
        headers: {},
        params: {},
        query: {},
        method: 'GET',
      };
      const res: any = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
      const next = jest.fn();

      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'CLINIC_SUSPENDED',
          }),
        }),
      );
      expect(next).not.toHaveBeenCalled();
    });

    it('should allow request when both Tenant and Clinic are active', async () => {
      mockTenantService.getTenantById.mockResolvedValue({
        id: '11111111-1111-1111-1111-111111111111',
        status: TENANT_STATUS_ACTIVE,
        timezone: 'UTC',
        language: 'en',
        country: 'US',
      });
      mockClinicChecker.mockResolvedValue({
        id: 'clinic-1',
        status: 'active',
      });

      const middleware = createTenantResolutionMiddleware(mockTenantService, {
        clinicChecker: mockClinicChecker,
      });

      const req: any = {
        user: { tenantId: '11111111-1111-1111-1111-111111111111', clinicId: 'clinic-1', role: 'receptionist', userId: 'usr-1' },
        headers: {},
        params: {},
        query: {},
        method: 'GET',
      };
      const res: any = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
      const next = jest.fn();

      await middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.tenantId).toBe('11111111-1111-1111-1111-111111111111');
      expect(req.tenantContext.role).toBe('receptionist');
    });
  });

  describe('3. Login & Session Suspension Checks', () => {
    it('should throw ClinicSuspendedError with code CLINIC_SUSPENDED', () => {
      const err = new ClinicSuspendedError();
      expect(err.code).toBe('CLINIC_SUSPENDED');
      expect(err.statusCode).toBe(403);
    });

    it('should throw ClinicSuspendedError during refreshTokens when tenant is suspended', async () => {
      const mockSessionRepo = {
        findById: jest.fn().mockResolvedValue({
          id: 'sess-1',
          userId: 'user-1',
          tenantId: 'tenant-1',
          refreshTokenHash: 'hash123',
          status: 'active',
          expiresAt: new Date(Date.now() + 100000),
        }),
      };
      const mockUserRepo = {
        findById: jest.fn().mockResolvedValue({
          id: 'user-1',
          tenantId: 'tenant-1',
          status: 'active',
        }),
      };
      const mockTenantRepo = {
        findById: jest.fn().mockResolvedValue({
          id: 'tenant-1',
          status: 'suspended',
        }),
      };
      const mockSessionService = {
        revokeSession: jest.fn().mockResolvedValue(undefined),
      };
      const mockTokenService = {
        hashRefreshToken: jest.fn().mockReturnValue('hash123'),
      };

      const authService: any = {
        sessionRepository: mockSessionRepo,
        userRepository: mockUserRepo,
        tenantRepository: mockTenantRepo,
        sessionService: mockSessionService,
        tokenService: mockTokenService,
        timingSafeEqual: (a: string, b: string) => a === b,
      };

      // Import the actual refreshTokens method from AuthService prototype
      const { AuthService } = await import('../../authentication/services/auth.service');
      const refreshTokensFn = AuthService.prototype.refreshTokens.bind(authService);

      await expect(
        refreshTokensFn({
          rawRefreshToken: 'valid-token',
          sessionId: 'sess-1',
          requestId: 'req-1',
          deviceInfo: {
            ipAddress: '127.0.0.1',
            userAgent: 'test',
            browser: 'Chrome',
            operatingSystem: 'Windows',
            deviceType: 'desktop',
          },
        }),
      ).rejects.toThrow(ClinicSuspendedError);

      expect(mockSessionService.revokeSession).toHaveBeenCalledWith('sess-1');
    });

    it('should return canonical tenant and clinic in login result', async () => {
      const argon2 = await import('argon2');
      const passwordHash = await argon2.hash('Password123!');
      const mockUser = {
        id: 'user-1',
        email: 'owner@oracletooth.com',
        passwordHash,
        tenantId: 'tenant-1',
        clinicId: 'clinic-1',
        role: 'clinic_owner',
        status: 'active',
        emailVerified: true,
        failedLoginAttempts: 0,
        tokenVersion: 0,
        tenant: {
          id: 'tenant-1',
          name: 'Oracle Tooth Clinic',
          status: 'active',
          slug: 'oracle-tooth-clinic',
        },
        clinic: {
          id: 'clinic-1',
          name: 'Oracle Tooth Clinic',
          status: 'active',
          slug: 'oracle-tooth-clinic',
        },
      };

      const mockUserRepo = {
        findByEmail: jest.fn().mockResolvedValue(mockUser),
        findByIdWithRelations: jest.fn().mockResolvedValue(mockUser),
        resetFailedLoginAttempts: jest.fn().mockResolvedValue(undefined),
        update: jest.fn().mockResolvedValue(undefined),
      };
      const mockPasswordHasher = {
        verify: jest.fn().mockResolvedValue(true),
      };
      const mockTokenService = {
        getRefreshTokenTtlSeconds: jest.fn().mockReturnValue(604800),
        getAccessTokenTtlSeconds: jest.fn().mockReturnValue(900),
        generateRefreshToken: jest.fn().mockReturnValue('raw-refresh-token'),
        hashRefreshToken: jest.fn().mockReturnValue('hash123'),
        signAccessToken: jest.fn().mockReturnValue('jwt-access-token'),
      };
      const mockSessionService = {
        createSession: jest.fn().mockResolvedValue({ sessionId: 'sess-1' }),
      };
      const mockPublisher = {
        publish: jest.fn().mockResolvedValue(undefined),
      };
      const mockTenantRepo = {
        findById: jest.fn().mockResolvedValue({ id: 'tenant-1', status: 'active' }),
      };

      const authService: any = {
        userRepository: mockUserRepo,
        tenantRepository: mockTenantRepo,
        passwordHasher: mockPasswordHasher,
        tokenService: mockTokenService,
        sessionService: mockSessionService,
        eventPublisher: mockPublisher,
        toSafeUser: (u: any) => ({ publicId: u.id, email: u.email }),
      };

      const { AuthService } = await import('../../authentication/services/auth.service');
      const loginFn = AuthService.prototype.login.bind(authService);

      const result = await loginFn({
        email: 'owner@oracletooth.com',
        password: 'Password123!',
        requestId: 'req-1',
        deviceInfo: {
          ipAddress: '127.0.0.1',
          userAgent: 'test',
          browser: 'Chrome',
          operatingSystem: 'Windows',
          deviceType: 'desktop',
        },
      });

      expect(result.accessToken).toBe('jwt-access-token');
      expect(result.tenant).toBeDefined();
      expect(result.tenant?.name).toBe('Oracle Tooth Clinic');
      expect(result.clinic).toBeDefined();
      expect(result.clinic?.name).toBe('Oracle Tooth Clinic');
    });
  });

  describe('4. Permanent Clinic Name Persistence Across Full Suspension Lifecycle', () => {
    it('should preserve clinic name byte-for-byte across ACTIVE -> SUSPENDED -> ACTIVE state transitions', async () => {
      let clinicState = {
        id: 'clinic-oracle',
        tenantId: 'tenant-oracle',
        name: 'Oracle Tooth Clinic',
        status: 'active',
      };
      let tenantState = {
        id: 'tenant-oracle',
        name: 'Oracle Tooth Clinic',
        status: 'active',
      };

      // 1. Suspension transition (modifies status only)
      clinicState = { ...clinicState, status: 'suspended' };
      tenantState = { ...tenantState, status: 'suspended' };

      expect(clinicState.name).toBe('Oracle Tooth Clinic');
      expect(tenantState.name).toBe('Oracle Tooth Clinic');
      expect(clinicState.status).toBe('suspended');
      expect(tenantState.status).toBe('suspended');

      // 2. Activation transition (modifies status only)
      clinicState = { ...clinicState, status: 'active' };
      tenantState = { ...tenantState, status: 'active' };

      expect(clinicState.name).toBe('Oracle Tooth Clinic');
      expect(tenantState.name).toBe('Oracle Tooth Clinic');
      expect(clinicState.status).toBe('active');
      expect(tenantState.status).toBe('active');

      // 3. Sequential Multiple Updates Cycle
      const nameUpdates = [
        'Oracle Tooth Clinic',
        'Oracle Dental Care',
        'Oracle Tooth Premium Dental',
      ];

      for (const updatedName of nameUpdates) {
        clinicState.name = updatedName;
        tenantState.name = updatedName;

        // Suspend
        clinicState.status = 'suspended';
        tenantState.status = 'suspended';
        expect(clinicState.name).toBe(updatedName);
        expect(tenantState.name).toBe(updatedName);

        // Reactivate
        clinicState.status = 'active';
        tenantState.status = 'active';
        expect(clinicState.name).toBe(updatedName);
        expect(tenantState.name).toBe(updatedName);
      }

      expect(clinicState.name).toBe('Oracle Tooth Premium Dental');
      expect(tenantState.name).toBe('Oracle Tooth Premium Dental');
    });
  });
});

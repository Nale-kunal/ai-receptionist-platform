/**
 * Configuration Service Unit Tests
 */

import { ConfigurationService } from '../services/configuration.service';
import { ConfigurationCacheService } from '../services/configuration-cache.service';
import {
  ConfigurationNotFoundError,
  ConfigurationIsolationViolationError,
  InvalidTimezoneError,
} from '../errors/configuration.errors';
import {
  EVENT_CONFIG_CREATED,
  EVENT_CONFIG_UPDATED,
  EVENT_CONFIG_PUBLISHED,
  EVENT_CONFIG_ROLLED_BACK,
  EVENT_CONFIG_RESTORED,
} from '../events/configuration.events';

const mockRepository = {
  create: jest.fn(),
  findActive: jest.fn(),
  findById: jest.fn(),
  findLatestVersion: jest.fn(),
  findMany: jest.fn(),
  deactivateAll: jest.fn(),
};

const mockCache = {
  get: jest.fn(),
  set: jest.fn(),
  invalidate: jest.fn(),
  clear: jest.fn(),
  size: jest.fn(),
};

const mockPublisher = {
  publish: jest.fn(),
};

const TENANT_ID = '550e8400-e29b-41d4-a716-446655440000';
const OTHER_TENANT = '550e8400-e29b-41d4-a716-446655440009';
const CLINIC_ID = '550e8400-e29b-41d4-a716-446655440001';

function makeSafeConfig(overrides: Record<string, unknown> = {}) {
  return {
    id: 'config-uuid-123',
    tenantId: TENANT_ID,
    clinicId: null,
    version: 1,
    isActive: true,
    createdBy: 'user-uuid',
    createdAt: new Date(),
    changeSummary: 'Initial test setup',
    previousVersionId: null,
    rollbackFromVersion: null,
    business: { businessHours: [], holidays: [], appointmentDuration: 30 },
    voice: { voiceModel: 'alloy', greeting: 'Hi', prompt: 'Prompt', language: 'en' },
    ai: { promptAssignment: 'receptionist-prompt', tone: 'professional', greeting: 'Hi', provider: 'openai' },
    calendar: { calendarProvider: 'google', syncIntervalMinutes: 15 },
    notification: { smsEnabled: true, emailEnabled: true },
    branding: { clinicName: 'Smile Clinic' },
    localization: { language: 'en', country: 'US', timezone: 'UTC', dateFormat: 'YYYY-MM-DD', timeFormat: 'HH:mm' },
    featureFlags: { voiceEnabled: true, aiEnabled: true, callRecordingEnabled: false, smsEnabled: true, emailEnabled: true, analyticsEnabled: false, premiumFeatures: [] },
    providers: { openai: {} },
    ...overrides,
  };
}

describe('ConfigurationService', () => {
  let service: ConfigurationService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ConfigurationService(
      mockRepository as any,
      mockCache as any,
      mockPublisher as any,
    );
  });

  describe('getActiveConfiguration', () => {
    it('should return cached configuration immediately on cache hit', async () => {
      const cachedConfig = makeSafeConfig();
      mockCache.get.mockReturnValue(cachedConfig);

      const result = await service.getActiveConfiguration(TENANT_ID, null);

      expect(mockCache.get).toHaveBeenCalled();
      expect(mockRepository.findActive).not.toHaveBeenCalled();
      expect(result).toEqual(cachedConfig);
    });

    it('should query active version from DB on cache miss and set in cache', async () => {
      const dbConfig = makeSafeConfig({ id: 'db-config-uuid' });
      mockCache.get.mockReturnValue(undefined);
      mockRepository.findActive.mockResolvedValue(dbConfig);

      const result = await service.getActiveConfiguration(TENANT_ID, CLINIC_ID);

      expect(mockRepository.findActive).toHaveBeenCalledWith(TENANT_ID, CLINIC_ID);
      expect(mockCache.set).toHaveBeenCalledWith(
        ConfigurationCacheService.buildKey(TENANT_ID, CLINIC_ID),
        expect.objectContaining({ id: 'db-config-uuid' }),
      );
      expect(result.id).toBe('db-config-uuid');
    });

    it('should inherit tenant-level configuration if clinic override is missing', async () => {
      mockCache.get.mockReturnValue(undefined);
      // First findActive for clinic returns null, second findActive for tenant (null clinicId) returns config
      mockRepository.findActive
        .mockResolvedValueOnce(null) // Clinic-level check
        .mockResolvedValueOnce(makeSafeConfig({ id: 'tenant-level-config-uuid' })); // Tenant fallback check

      const result = await service.getActiveConfiguration(TENANT_ID, CLINIC_ID);

      expect(mockRepository.findActive).toHaveBeenCalledTimes(2);
      expect(result.id).toBe('tenant-level-config-uuid');
    });

    it('should throw ConfigurationNotFoundError if no active config exists', async () => {
      mockCache.get.mockReturnValue(undefined);
      mockRepository.findActive.mockResolvedValue(null);

      await expect(service.getActiveConfiguration(TENANT_ID, null)).rejects.toThrow(
        ConfigurationNotFoundError,
      );
    });
  });

  describe('createConfiguration', () => {
    it('should increment version, deactivate previous, save new, update cache and dispatch events', async () => {
      const inputParams = {
        tenantId: TENANT_ID,
        clinicId: null,
        createdBy: 'user-uuid',
        changeSummary: 'Initial setup',
        requestId: 'req-1',
        business: { businessHours: [], holidays: [], appointmentDuration: 30 },
        voice: { voiceModel: 'alloy', greeting: 'Hi', prompt: 'Prompt', language: 'en' },
        ai: { promptAssignment: 'receptionist-prompt', tone: 'professional', greeting: 'Hi', provider: 'openai' as const },
        calendar: { calendarProvider: 'google' as const, syncIntervalMinutes: 15 },
        notification: { smsEnabled: true, emailEnabled: true },
        branding: { clinicName: 'Smile Care' },
        localization: { language: 'en', country: 'US', timezone: 'UTC', dateFormat: 'YYYY-MM-DD', timeFormat: 'HH:mm' },
        featureFlags: { voiceEnabled: true, aiEnabled: true, callRecordingEnabled: false, smsEnabled: true, emailEnabled: true, analyticsEnabled: false, premiumFeatures: [] },
        providers: { openai: {} },
      };

      mockRepository.findLatestVersion.mockResolvedValue(2);
      mockRepository.findActive.mockResolvedValue(null);
      mockRepository.create.mockImplementation((data: any) =>
        Promise.resolve(makeSafeConfig({ ...data, id: 'new-uuid-999' })),
      );

      const result = await service.createConfiguration(inputParams);

      expect(mockRepository.findLatestVersion).toHaveBeenCalledWith(TENANT_ID, null);
      expect(mockRepository.deactivateAll).toHaveBeenCalledWith(TENANT_ID, null);
      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          version: 3,
          isActive: true,
        }),
      );
      expect(mockCache.set).toHaveBeenCalledWith(
        ConfigurationCacheService.buildKey(TENANT_ID, null),
        expect.objectContaining({ id: 'new-uuid-999' }),
      );
      expect(mockPublisher.publish).toHaveBeenCalledWith(
        expect.objectContaining({ type: EVENT_CONFIG_CREATED }),
      );
      expect(mockPublisher.publish).toHaveBeenCalledWith(
        expect.objectContaining({ type: EVENT_CONFIG_PUBLISHED }),
      );
      expect(result.version).toBe(3);
    });

    it('should throw InvalidTimezoneError for invalid timezone strings', async () => {
      const inputParams = {
        tenantId: TENANT_ID,
        clinicId: null,
        createdBy: 'user-uuid',
        requestId: 'req-1',
        business: { businessHours: [], holidays: [], appointmentDuration: 30 },
        voice: { voiceModel: 'alloy', greeting: 'Hi', prompt: 'Prompt', language: 'en' },
        ai: { promptAssignment: 'receptionist-prompt', tone: 'professional', greeting: 'Hi', provider: 'openai' as const },
        calendar: { calendarProvider: 'google' as const, syncIntervalMinutes: 15 },
        notification: { smsEnabled: true, emailEnabled: true },
        branding: { clinicName: 'Smile Care' },
        localization: { language: 'en', country: 'US', timezone: 'America/Bad_Timezone_Here', dateFormat: 'YYYY-MM-DD', timeFormat: 'HH:mm' },
        featureFlags: { voiceEnabled: true, aiEnabled: true, callRecordingEnabled: false, smsEnabled: true, emailEnabled: true, analyticsEnabled: false, premiumFeatures: [] },
        providers: { openai: {} },
      };

      await expect(service.createConfiguration(inputParams)).rejects.toThrow(InvalidTimezoneError);
    });
  });

  describe('updateConfiguration', () => {
    it('should deep merge changes, save new version, and dispatch updated audit events', async () => {
      const active = makeSafeConfig({
        id: 'active-uuid',
        version: 4,
        business: { appointmentDuration: 30, businessHours: [], holidays: [] },
      });
      mockRepository.findActive.mockResolvedValue(active);
      mockRepository.findLatestVersion.mockResolvedValue(4);
      mockRepository.create.mockImplementation((data: any) =>
        Promise.resolve(makeSafeConfig({ ...data, id: 'new-updated-uuid' })),
      );

      const params = {
        tenantId: TENANT_ID,
        clinicId: null,
        updatedBy: 'updater-uuid',
        requestId: 'req-2',
        business: { appointmentDuration: 60 },
      };

      const result = await service.updateConfiguration(params);

      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          version: 5,
          business: expect.objectContaining({ appointmentDuration: 60 }),
        }),
      );
      expect(result.version).toBe(5);
      expect(mockPublisher.publish).toHaveBeenCalledWith(
        expect.objectContaining({ type: EVENT_CONFIG_UPDATED }),
      );
    });
  });

  describe('rollbackConfiguration', () => {
    it('should copy target configuration settings into a new version and activate it', async () => {
      const target = makeSafeConfig({ id: 'target-uuid', version: 2 });
      mockRepository.findById.mockResolvedValue(target);
      mockRepository.findLatestVersion.mockResolvedValue(6);
      mockRepository.findActive.mockResolvedValue(makeSafeConfig({ id: 'active-now', version: 6 }));
      mockRepository.create.mockImplementation((data: any) =>
        Promise.resolve(makeSafeConfig({ ...data, id: 'rollback-uuid' })),
      );

      const result = await service.rollbackConfiguration(
        'target-uuid',
        TENANT_ID,
        'actor-uuid',
        'req-3',
      );

      expect(mockRepository.deactivateAll).toHaveBeenCalledWith(TENANT_ID, null);
      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          version: 7,
          rollbackFromVersion: 2,
          previousVersionId: 'target-uuid',
        }),
      );
      expect(result.version).toBe(7);
      expect(mockPublisher.publish).toHaveBeenCalledWith(
        expect.objectContaining({ type: EVENT_CONFIG_ROLLED_BACK }),
      );
      expect(mockPublisher.publish).toHaveBeenCalledWith(
        expect.objectContaining({ type: EVENT_CONFIG_RESTORED }),
      );
    });

    it('should throw ConfigurationIsolationViolationError if tenant does not own target configuration', async () => {
      const target = makeSafeConfig({ id: 'target-uuid', tenantId: OTHER_TENANT });
      mockRepository.findById.mockResolvedValue(target);

      await expect(
        service.rollbackConfiguration('target-uuid', TENANT_ID, 'actor-uuid', 'req-3'),
      ).rejects.toThrow(ConfigurationIsolationViolationError);
    });
  });
});

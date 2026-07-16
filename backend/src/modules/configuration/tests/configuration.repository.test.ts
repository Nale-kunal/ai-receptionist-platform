/**
 * Configuration Repository Unit Tests
 */

import { ConfigurationRepository } from '../repositories/configuration.repository';

const mockPrismaConfig = {
  create: jest.fn(),
  updateMany: jest.fn(),
  findFirst: jest.fn(),
  findMany: jest.fn(),
};

const mockPrisma = {
  configuration: mockPrismaConfig,
} as any;

function makeDbConfig(overrides: Record<string, unknown> = {}) {
  return {
    id: '550e8400-e29b-41d4-a716-446655440001',
    tenantId: '550e8400-e29b-41d4-a716-446655440000',
    clinicId: null,
    version: 1,
    isActive: true,
    createdBy: '550e8400-e29b-41d4-a716-446655440002',
    createdAt: new Date(),
    changeSummary: 'Initial setup',
    previousVersionId: null,
    rollbackFromVersion: null,
    business: {},
    voice: {},
    ai: {},
    calendar: {},
    notification: {},
    branding: {},
    localization: {},
    featureFlags: {},
    providers: {},
    ...overrides,
  };
}

describe('ConfigurationRepository', () => {
  let repository: ConfigurationRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repository = new ConfigurationRepository(mockPrisma);
  });

  describe('create', () => {
    it('should call prisma.configuration.create with correct data', async () => {
      const data = {
        tenantId: '550e8400-e29b-41d4-a716-446655440000',
        clinicId: null,
        version: 1,
        isActive: true,
        createdBy: '550e8400-e29b-41d4-a716-446655440002',
        business: { appointmentDuration: 30 },
        voice: { voiceModel: 'alloy' },
        ai: { provider: 'openai' },
        calendar: { calendarProvider: 'google' },
        notification: { smsEnabled: true },
        branding: { clinicName: 'Smile Care' },
        localization: { timezone: 'America/New_York' },
        featureFlags: { aiEnabled: true },
        providers: { openai: {} },
      };

      mockPrismaConfig.create.mockResolvedValue(makeDbConfig(data as any));

      const result = await repository.create(data as any);
      expect(mockPrismaConfig.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tenantId: '550e8400-e29b-41d4-a716-446655440000',
          version: 1,
          isActive: true,
        }),
      });
      expect(result.version).toBe(1);
    });
  });

  describe('findActive', () => {
    it('should query active version by tenant and clinic ID', async () => {
      mockPrismaConfig.findFirst.mockResolvedValue(makeDbConfig({ isActive: true }));

      const result = await repository.findActive(
        '550e8400-e29b-41d4-a716-446655440000',
        '550e8400-e29b-41d4-a716-446655440003',
      );

      expect(mockPrismaConfig.findFirst).toHaveBeenCalledWith({
        where: {
          tenantId: '550e8400-e29b-41d4-a716-446655440000',
          clinicId: '550e8400-e29b-41d4-a716-446655440003',
          isActive: true,
        },
      });
      expect(result.isActive).toBe(true);
    });
  });

  describe('findLatestVersion', () => {
    it('should query highest version number and default to 0 if none found', async () => {
      mockPrismaConfig.findFirst.mockResolvedValue(null);

      const count = await repository.findLatestVersion(
        '550e8400-e29b-41d4-a716-446655440000',
        null,
      );
      expect(count).toBe(0);
    });

    it('should return version of latest configuration if present', async () => {
      mockPrismaConfig.findFirst.mockResolvedValue(makeDbConfig({ version: 5 }));

      const count = await repository.findLatestVersion(
        '550e8400-e29b-41d4-a716-446655440000',
        null,
      );
      expect(count).toBe(5);
    });
  });

  describe('deactivateAll', () => {
    it('should update many to set isActive: false for matching configs', async () => {
      mockPrismaConfig.updateMany.mockResolvedValue({ count: 1 });

      await repository.deactivateAll('550e8400-e29b-41d4-a716-446655440000', null);

      expect(mockPrismaConfig.updateMany).toHaveBeenCalledWith({
        where: {
          tenantId: '550e8400-e29b-41d4-a716-446655440000',
          clinicId: null,
          isActive: true,
        },
        data: {
          isActive: false,
        },
      });
    });
  });
});

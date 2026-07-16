/**
 * Tenant Repository Unit Tests
 *
 * Verifies that the TenantRepository correctly calls Prisma.
 */

import { TenantRepository } from '../repositories/tenant.repository';

const mockPrismaTenant = {
  create: jest.fn(),
  update: jest.fn(),
  findFirst: jest.fn(),
  findMany: jest.fn(),
  count: jest.fn(),
};

const mockPrisma = {
  tenant: mockPrismaTenant,
} as any;

function makeDbTenant(overrides: Record<string, unknown> = {}) {
  return {
    id: 'd9b2326b-f458-47e2-881c-cb8b4445d045',
    publicId: 'tnt_abc123',
    name: 'Smile Clinic',
    slug: 'smile-clinic',
    status: 'created',
    timezone: 'UTC',
    country: 'US',
    language: 'en',
    subscriptionPlan: 'free',
    branding: {},
    metadata: {},
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...overrides,
  };
}

describe('TenantRepository', () => {
  let repository: TenantRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repository = new TenantRepository(mockPrisma);
  });

  describe('create', () => {
    it('should call prisma.tenant.create with correct data', async () => {
      const dbTenant = makeDbTenant();
      mockPrismaTenant.create.mockResolvedValue(dbTenant);

      const payload = {
        name: 'Smile Clinic',
        slug: 'smile-clinic',
        status: 'created' as const,
        timezone: 'UTC',
        country: 'US',
        language: 'en',
        subscriptionPlan: 'free' as const,
      };

      const result = await repository.create(payload);

      expect(mockPrismaTenant.create).toHaveBeenCalledTimes(1);
      expect(mockPrismaTenant.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: 'Smile Clinic',
            slug: 'smile-clinic',
          }),
        }),
      );
      expect(result).toEqual(dbTenant);
    });
  });

  describe('update', () => {
    it('should call prisma.tenant.update with correct data', async () => {
      const dbTenant = makeDbTenant({ name: 'New Smile Clinic' });
      mockPrismaTenant.update.mockResolvedValue(dbTenant);

      const result = await repository.update('d9b2326b-f458-47e2-881c-cb8b4445d045', {
        name: 'New Smile Clinic',
      });

      expect(mockPrismaTenant.update).toHaveBeenCalledTimes(1);
      expect(mockPrismaTenant.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'd9b2326b-f458-47e2-881c-cb8b4445d045' },
          data: expect.objectContaining({
            name: 'New Smile Clinic',
          }),
        }),
      );
      expect(result).toEqual(dbTenant);
    });
  });

  describe('findById', () => {
    it('should query by id and default to excluding soft-deleted', async () => {
      const dbTenant = makeDbTenant();
      mockPrismaTenant.findFirst.mockResolvedValue(dbTenant);

      const result = await repository.findById('d9b2326b-f458-47e2-881c-cb8b4445d045');

      expect(mockPrismaTenant.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            id: 'd9b2326b-f458-47e2-881c-cb8b4445d045',
            deletedAt: null,
          },
        }),
      );
      expect(result).toEqual(dbTenant);
    });

    it('should include soft-deleted if includeDeleted is true', async () => {
      const dbTenant = makeDbTenant({ deletedAt: new Date() });
      mockPrismaTenant.findFirst.mockResolvedValue(dbTenant);

      const result = await repository.findById('d9b2326b-f458-47e2-881c-cb8b4445d045', true);

      expect(mockPrismaTenant.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            id: 'd9b2326b-f458-47e2-881c-cb8b4445d045',
          },
        }),
      );
      expect(result).toEqual(dbTenant);
    });
  });

  describe('exists', () => {
    it('should return true if count > 0', async () => {
      mockPrismaTenant.count.mockResolvedValue(1);
      const result = await repository.exists('smile-clinic');
      expect(result).toBe(true);
      expect(mockPrismaTenant.count).toHaveBeenCalledWith({
        where: { slug: 'smile-clinic', deletedAt: null },
      });
    });

    it('should return false if count is 0', async () => {
      mockPrismaTenant.count.mockResolvedValue(0);
      const result = await repository.exists('smile-clinic');
      expect(result).toBe(false);
    });
  });
});

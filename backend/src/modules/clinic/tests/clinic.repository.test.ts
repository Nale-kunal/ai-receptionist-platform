/**
 * Clinic Repository Unit Tests
 */

import { ClinicRepository } from '../repositories/clinic.repository';

const mockPrismaClinic = {
  create: jest.fn(),
  update: jest.fn(),
  findFirst: jest.fn(),
  findMany: jest.fn(),
  count: jest.fn(),
};

const mockPrismaUser = {
  count: jest.fn(),
};

const mockPrisma = {
  clinic: mockPrismaClinic,
  user: mockPrismaUser,
} as any;

function makeDbClinic(overrides: Record<string, unknown> = {}) {
  return {
    id: '550e8400-e29b-41d4-a716-446655440001',
    publicId: 'clnc_abc123',
    tenantId: '550e8400-e29b-41d4-a716-446655440000',
    ownerId: '550e8400-e29b-41d4-a716-446655440002',
    name: 'Smile Care',
    slug: 'smile-care',
    timezone: 'UTC',
    country: 'US',
    status: 'pending_setup',
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...overrides,
  };
}

describe('ClinicRepository', () => {
  let repository: ClinicRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repository = new ClinicRepository(mockPrisma);
  });

  describe('create', () => {
    it('should call prisma.clinic.create with correct data', async () => {
      const data = {
        tenantId: '550e8400-e29b-41d4-a716-446655440000',
        ownerId: '550e8400-e29b-41d4-a716-446655440002',
        name: 'Smile Care',
        slug: 'smile-care',
        timezone: 'UTC',
        country: 'US',
        status: 'pending_setup' as const,
      };

      mockPrismaClinic.create.mockResolvedValue(makeDbClinic(data));

      const result = await repository.create(data);
      expect(mockPrismaClinic.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tenantId: '550e8400-e29b-41d4-a716-446655440000',
          slug: 'smile-care',
        }),
      });
      expect(result.slug).toBe('smile-care');
    });
  });

  describe('update', () => {
    it('should call prisma.clinic.update with correct payload', async () => {
      mockPrismaClinic.update.mockResolvedValue(makeDbClinic({ name: 'Updated' }));

      const result = await repository.update('550e8400-e29b-41d4-a716-446655440001', {
        name: 'Updated',
      });

      expect(mockPrismaClinic.update).toHaveBeenCalledWith({
        where: { id: '550e8400-e29b-41d4-a716-446655440001' },
        data: expect.objectContaining({
          name: 'Updated',
        }),
      });
      expect(result.name).toBe('Updated');
    });
  });

  describe('userBelongsToTenant', () => {
    it('should return true if user exists in the tenant', async () => {
      mockPrismaUser.count.mockResolvedValue(1);

      const result = await repository.userBelongsToTenant(
        '550e8400-e29b-41d4-a716-446655440002',
        '550e8400-e29b-41d4-a716-446655440000',
      );

      expect(result).toBe(true);
      expect(mockPrismaUser.count).toHaveBeenCalledWith({
        where: {
          id: '550e8400-e29b-41d4-a716-446655440002',
          tenantId: '550e8400-e29b-41d4-a716-446655440000',
          deletedAt: null,
        },
      });
    });

    it('should return false if user does not exist in the tenant', async () => {
      mockPrismaUser.count.mockResolvedValue(0);

      const result = await repository.userBelongsToTenant(
        '550e8400-e29b-41d4-a716-446655440002',
        '550e8400-e29b-41d4-a716-446655440000',
      );

      expect(result).toBe(false);
    });
  });
});

/**
 * Doctor Repository Unit Tests
 */

import { DoctorRepository } from '../repositories/doctor.repository';

const mockPrismaDoctor = {
  create: jest.fn(),
  update: jest.fn(),
  findFirst: jest.fn(),
  findMany: jest.fn(),
  count: jest.fn(),
};

const mockPrismaClinic = {
  count: jest.fn(),
};

const mockPrisma = {
  doctor: mockPrismaDoctor,
  clinic: mockPrismaClinic,
} as any;

function makeDbDoctor(overrides: Record<string, unknown> = {}) {
  return {
    id: '550e8400-e29b-41d4-a716-446655440001',
    publicId: 'dctr_abc123',
    tenantId: '550e8400-e29b-41d4-a716-446655440000',
    clinicId: '550e8400-e29b-41d4-a716-446655440002',
    fullName: 'Dr. John Doe',
    displayName: 'Dr. Doe',
    specialization: 'General Dentistry',
    licenseNumber: 'LIC-1',
    status: 'active',
    workingHours: [],
    leaves: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...overrides,
  };
}

describe('DoctorRepository', () => {
  let repository: DoctorRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repository = new DoctorRepository(mockPrisma);
  });

  describe('create', () => {
    it('should call prisma.doctor.create with correct data', async () => {
      const data = {
        tenantId: '550e8400-e29b-41d4-a716-446655440000',
        clinicId: '550e8400-e29b-41d4-a716-446655440002',
        fullName: 'Dr. John Doe',
        displayName: 'Dr. Doe',
        specialization: 'General Dentistry',
        licenseNumber: 'LIC-1',
        status: 'active' as const,
        workingHours: [],
        leaves: [],
      };

      mockPrismaDoctor.create.mockResolvedValue(makeDbDoctor(data));

      const result = await repository.create(data);
      expect(mockPrismaDoctor.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tenantId: '550e8400-e29b-41d4-a716-446655440000',
          clinicId: '550e8400-e29b-41d4-a716-446655440002',
          licenseNumber: 'LIC-1',
        }),
      });
      expect(result.licenseNumber).toBe('LIC-1');
    });
  });

  describe('update', () => {
    it('should call prisma.doctor.update with correct payload', async () => {
      mockPrismaDoctor.update.mockResolvedValue(makeDbDoctor({ fullName: 'Dr. Updated' }));

      const result = await repository.update('550e8400-e29b-41d4-a716-446655440001', {
        fullName: 'Dr. Updated',
      });

      expect(mockPrismaDoctor.update).toHaveBeenCalledWith({
        where: { id: '550e8400-e29b-41d4-a716-446655440001' },
        data: expect.objectContaining({
          fullName: 'Dr. Updated',
        }),
      });
      expect(result.fullName).toBe('Dr. Updated');
    });
  });

  describe('clinicBelongsToTenant', () => {
    it('should return true if clinic exists in tenant', async () => {
      mockPrismaClinic.count.mockResolvedValue(1);

      const result = await repository.clinicBelongsToTenant(
        '550e8400-e29b-41d4-a716-446655440002',
        '550e8400-e29b-41d4-a716-446655440000',
      );

      expect(result).toBe(true);
      expect(mockPrismaClinic.count).toHaveBeenCalledWith({
        where: {
          id: '550e8400-e29b-41d4-a716-446655440002',
          tenantId: '550e8400-e29b-41d4-a716-446655440000',
          deletedAt: null,
        },
      });
    });
  });
});

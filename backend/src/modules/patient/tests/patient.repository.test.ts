/**
 * Patient Repository Unit Tests
 */

import { PatientRepository } from '../repositories/patient.repository';

const mockPrismaPatient = {
  create: jest.fn(),
  update: jest.fn(),
  findFirst: jest.fn(),
  findMany: jest.fn(),
};

const mockPrismaClinic = {
  count: jest.fn(),
};

const mockPrisma = {
  patient: mockPrismaPatient,
  clinic: mockPrismaClinic,
} as any;

function makeDbPatient(overrides: Record<string, unknown> = {}) {
  return {
    id: '550e8400-e29b-41d4-a716-446655440001',
    publicId: 'pat_abc123',
    tenantId: '550e8400-e29b-41d4-a716-446655440000',
    clinicId: '550e8400-e29b-41d4-a716-446655440002',
    fullName: 'Jane Smith',
    phone: '+15555554321',
    email: 'janesmith@example.com',
    status: 'active',
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...overrides,
  };
}

describe('PatientRepository', () => {
  let repository: PatientRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repository = new PatientRepository(mockPrisma);
  });

  describe('create', () => {
    it('should call prisma.patient.create with correct data', async () => {
      const data = {
        tenantId: '550e8400-e29b-41d4-a716-446655440000',
        clinicId: '550e8400-e29b-41d4-a716-446655440002',
        fullName: 'Jane Smith',
        phone: '+15555554321',
        email: 'janesmith@example.com',
        preferredLanguage: 'en',
        preferredContactMethod: 'sms' as const,
        status: 'active' as const,
      };

      mockPrismaPatient.create.mockResolvedValue(makeDbPatient(data));

      const result = await repository.create(data);
      expect(mockPrismaPatient.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tenantId: '550e8400-e29b-41d4-a716-446655440000',
          phone: '+15555554321',
        }),
      });
      expect(result.phone).toBe('+15555554321');
    });
  });

  describe('findByPhone', () => {
    it('should query active patient by phone and clinicId', async () => {
      mockPrismaPatient.findFirst.mockResolvedValue(makeDbPatient());

      const result = await repository.findByPhone('+15555554321', '550e8400-e29b-41d4-a716-446655440002');
      expect(mockPrismaPatient.findFirst).toHaveBeenCalledWith({
        where: {
          phone: '+15555554321',
          clinicId: '550e8400-e29b-41d4-a716-446655440002',
          deletedAt: null,
        },
      });
      expect(result).not.toBeNull();
    });
  });
});

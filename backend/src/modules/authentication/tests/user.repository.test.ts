/**
 * User Repository Unit Tests
 *
 * Tests the UserRepository using a mocked Prisma client.
 */

import { UserRepository } from '../repositories/user.repository';

// --------------------------------------------------------------------------
// Mock Prisma Client
// --------------------------------------------------------------------------

const mockPrismaUser = {
  create: jest.fn(),
  findFirst: jest.fn(),
  update: jest.fn(),
  count: jest.fn(),
};

const mockPrisma = {
  user: mockPrismaUser,
} as any;

// --------------------------------------------------------------------------
// Test Data
// --------------------------------------------------------------------------

function makeDbUser(overrides: Record<string, unknown> = {}) {
  return {
    id: 'user-id-123',
    publicId: 'usr_abc123',
    email: 'test@example.com',
    passwordHash: '$argon2id$...',
    firstName: 'Test',
    lastName: 'User',
    tenantId: 'tenant-id-456',
    clinicId: null,
    role: 'clinic_owner',
    status: 'active',
    emailVerified: false,
    emailVerifiedAt: null,
    tokenVersion: 0,
    failedLoginAttempts: 0,
    lockedUntil: null,
    lastLoginAt: null,
    passwordChangedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...overrides,
  };
}

// --------------------------------------------------------------------------
// Tests
// --------------------------------------------------------------------------

describe('UserRepository', () => {
  let userRepository: UserRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    userRepository = new UserRepository(mockPrisma);
  });

  describe('create', () => {
    it('should call prisma.user.create with correct data', async () => {
      const dbUser = makeDbUser();
      mockPrismaUser.create.mockResolvedValue(dbUser);

      const result = await userRepository.create({
        email: 'test@example.com',
        passwordHash: '$argon2id$...',
        firstName: 'Test',
        lastName: 'User',
        tenantId: 'tenant-id-456',
      });

      expect(mockPrismaUser.create).toHaveBeenCalledTimes(1);
      expect(mockPrismaUser.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            email: 'test@example.com',
            tokenVersion: 0,
            failedLoginAttempts: 0,
          }),
        }),
      );
      expect(result).toEqual(dbUser);
    });
  });

  describe('findByEmail', () => {
    it('should query by normalized email and exclude soft-deleted', async () => {
      const dbUser = makeDbUser();
      mockPrismaUser.findFirst.mockResolvedValue(dbUser);

      const result = await userRepository.findByEmail('TEST@EXAMPLE.COM');

      expect(mockPrismaUser.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            email: 'test@example.com',
            deletedAt: null,
          }),
        }),
      );
      expect(result).toEqual(dbUser);
    });

    it('should return null when user not found', async () => {
      mockPrismaUser.findFirst.mockResolvedValue(null);

      const result = await userRepository.findByEmail('notfound@example.com');

      expect(result).toBeNull();
    });
  });

  describe('exists', () => {
    it('should return true when count is greater than 0', async () => {
      mockPrismaUser.count.mockResolvedValue(1);

      const result = await userRepository.exists('test@example.com');

      expect(result).toBe(true);
    });

    it('should return false when count is 0', async () => {
      mockPrismaUser.count.mockResolvedValue(0);

      const result = await userRepository.exists('notfound@example.com');

      expect(result).toBe(false);
    });
  });

  describe('incrementFailedLoginAttempts', () => {
    it('should call update with increment operator', async () => {
      const dbUser = makeDbUser({ failedLoginAttempts: 1 });
      mockPrismaUser.update.mockResolvedValue(dbUser);

      await userRepository.incrementFailedLoginAttempts('user-id-123');

      expect(mockPrismaUser.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-id-123' },
          data: expect.objectContaining({
            failedLoginAttempts: { increment: 1 },
          }),
        }),
      );
    });
  });

  describe('resetFailedLoginAttempts', () => {
    it('should reset attempts to 0 and clear lockedUntil', async () => {
      const dbUser = makeDbUser();
      mockPrismaUser.update.mockResolvedValue(dbUser);

      await userRepository.resetFailedLoginAttempts('user-id-123');

      expect(mockPrismaUser.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            failedLoginAttempts: 0,
            lockedUntil: null,
          }),
        }),
      );
    });
  });

  describe('incrementTokenVersion', () => {
    it('should increment tokenVersion using Prisma increment operator', async () => {
      const dbUser = makeDbUser({ tokenVersion: 1 });
      mockPrismaUser.update.mockResolvedValue(dbUser);

      await userRepository.incrementTokenVersion('user-id-123');

      expect(mockPrismaUser.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tokenVersion: { increment: 1 },
          }),
        }),
      );
    });
  });
});

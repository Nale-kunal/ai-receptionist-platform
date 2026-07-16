/**
 * Conversation Repository Unit Tests
 *
 * Verifies the IConversationRepository contract is correctly implemented.
 */

import { ConversationRepository } from '../repositories/conversation.repository';
import { Prisma } from '@prisma/client';

// ---------------------------------------------------------------------------
// Prisma Mock
// ---------------------------------------------------------------------------

const mockConversationDelegate = {
  create: jest.fn(),
  update: jest.fn(),
  findFirst: jest.fn(),
  findMany: jest.fn(),
};

const mockClinicDelegate = { count: jest.fn() };
const mockPatientDelegate = { count: jest.fn() };
const mockAppointmentDelegate = { count: jest.fn() };

const mockPrisma = {
  conversation: mockConversationDelegate,
  clinic: mockClinicDelegate,
  patient: mockPatientDelegate,
  appointment: mockAppointmentDelegate,
};

// ---------------------------------------------------------------------------
// Test Data
// ---------------------------------------------------------------------------

const TENANT_ID = '550e8400-e29b-41d4-a716-446655440000';
const CLINIC_ID = '550e8400-e29b-41d4-a716-446655440001';
const PATIENT_ID = '550e8400-e29b-41d4-a716-446655440002';
const APPT_ID = '550e8400-e29b-41d4-a716-446655440003';
const CONV_ID = '550e8400-e29b-41d4-a716-446655440004';

const START = new Date('2025-01-01T09:00:00Z');

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ConversationRepository', () => {
  let repo: ConversationRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new ConversationRepository(mockPrisma as any);
  });

  describe('create', () => {
    it('should call prisma.conversation.create with correct data', async () => {
      const conv = { id: CONV_ID };
      mockConversationDelegate.create.mockResolvedValue(conv);

      const result = await repo.create({
        tenantId: TENANT_ID,
        clinicId: CLINIC_ID,
        callSessionId: 'session-123',
        startedAt: START,
        status: 'initiated',
        language: 'en',
      });

      expect(mockConversationDelegate.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'initiated',
            language: 'en',
          }),
        }),
      );
      expect(result).toBe(conv);
    });
  });

  describe('update', () => {
    it('should cast Decimals and JSON columns correctly', async () => {
      mockConversationDelegate.update.mockResolvedValue({ id: CONV_ID });

      await repo.update(CONV_ID, {
        estimatedCostUsd: '0.00125',
        transcript: [{ sequence: 0, speaker: 'ai', message: 'Hello', timestamp: START.toISOString() }],
      });

      expect(mockConversationDelegate.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: CONV_ID },
          data: expect.objectContaining({
            estimatedCostUsd: new Prisma.Decimal('0.00125'),
            transcript: expect.any(Array),
          }),
        }),
      );
    });
  });

  describe('findById', () => {
    it('should query active records by default', async () => {
      mockConversationDelegate.findFirst.mockResolvedValue(null);
      await repo.findById(CONV_ID);
      expect(mockConversationDelegate.findFirst).toHaveBeenCalledWith({
        where: { id: CONV_ID, deletedAt: null },
      });
    });

    it('should query include soft-deleted if includeDeleted is true', async () => {
      mockConversationDelegate.findFirst.mockResolvedValue(null);
      await repo.findById(CONV_ID, true);
      expect(mockConversationDelegate.findFirst).toHaveBeenCalledWith({
        where: { id: CONV_ID },
      });
    });
  });

  describe('clinicIsActive', () => {
    it('should return true when clinic count > 0 and status is not suspended/deleted', async () => {
      mockClinicDelegate.count.mockResolvedValue(1);
      const result = await repo.clinicIsActive(CLINIC_ID, TENANT_ID);
      expect(result).toBe(true);
      expect(mockClinicDelegate.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: { notIn: ['suspended', 'deleted'] },
          }),
        }),
      );
    });
  });
});

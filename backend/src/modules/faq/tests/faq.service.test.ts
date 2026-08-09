import { FaqService } from '../services/faq.service';
import {
  FaqNotFoundError,
  FaqIsolationViolationError,
} from '../errors/faq.errors';
import {
  EVENT_FAQ_CREATED,
  EVENT_FAQ_UPDATED,
  EVENT_FAQ_DELETED,
  EVENT_FAQ_RESTORED,
} from '../constants/faq.constants';

describe('FaqService Unit Tests', () => {
  let service: FaqService;
  let mockRepository: any;
  let mockPublisher: any;

  beforeEach(() => {
    mockRepository = {
      create: jest.fn(),
      update: jest.fn(),
      findById: jest.fn(),
      findByPublicId: jest.fn(),
      findMany: jest.fn(),
      softDelete: jest.fn(),
      restore: jest.fn(),
      count: jest.fn(),
    };

    mockPublisher = {
      publish: jest.fn(),
    };

    service = new FaqService(mockRepository, mockPublisher);
  });

  describe('createFaq', () => {
    it('should create an FAQ and publish a created event', async () => {
      const mockRecord = {
        id: 'faq-1',
        publicId: 'faq_123',
        tenantId: 'tenant-1',
        question: 'What is your name?',
        answer: 'I am an AI receptionist.',
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      };

      mockRepository.create.mockResolvedValue(mockRecord);

      const result = await service.createFaq({
        tenantId: 'tenant-1',
        question: 'What is your name?',
        answer: 'I am an AI receptionist.',
        actorId: 'user-123',
        requestId: 'req-456',
      });

      expect(mockRepository.create).toHaveBeenCalledWith({
        tenantId: 'tenant-1',
        question: 'What is your name?',
        answer: 'I am an AI receptionist.',
      });

      expect(mockPublisher.publish).toHaveBeenCalledWith({
        type: EVENT_FAQ_CREATED,
        payload: expect.objectContaining({
          tenantId: 'tenant-1',
          faqId: 'faq-1',
          question: 'What is your name?',
          answer: 'I am an AI receptionist.',
          actorId: 'user-123',
          requestId: 'req-456',
        }),
      });

      expect(result.id).toBe('faq-1');
      expect(result.question).toBe('What is your name?');
    });
  });

  describe('updateFaq', () => {
    it('should update an FAQ and publish an updated event', async () => {
      const existingRecord = {
        id: 'faq-1',
        publicId: 'faq_123',
        tenantId: 'tenant-1',
        question: 'Old Question',
        answer: 'Old Answer',
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      };

      const updatedRecord = {
        ...existingRecord,
        question: 'New Question',
        answer: 'New Answer',
      };

      mockRepository.findById.mockResolvedValue(existingRecord);
      mockRepository.update.mockResolvedValue(updatedRecord);

      const result = await service.updateFaq({
        id: 'faq-1',
        tenantId: 'tenant-1',
        question: 'New Question',
        answer: 'New Answer',
        actorId: 'user-123',
        requestId: 'req-456',
      });

      expect(mockRepository.findById).toHaveBeenCalledWith('faq-1');
      expect(mockRepository.update).toHaveBeenCalledWith('faq-1', {
        question: 'New Question',
        answer: 'New Answer',
      });

      expect(mockPublisher.publish).toHaveBeenCalledWith({
        type: EVENT_FAQ_UPDATED,
        payload: expect.objectContaining({
          tenantId: 'tenant-1',
          faqId: 'faq-1',
          actorId: 'user-123',
          requestId: 'req-456',
          changedFields: expect.arrayContaining(['question', 'answer']),
        }),
      });

      expect(result.question).toBe('New Question');
    });

    it('should throw FaqNotFoundError if FAQ does not exist', async () => {
      mockRepository.findById.mockResolvedValue(null);

      await expect(
        service.updateFaq({
          id: 'faq-1',
          tenantId: 'tenant-1',
          question: 'New Question',
          actorId: 'user-123',
          requestId: 'req-456',
        }),
      ).rejects.toThrow(FaqNotFoundError);
    });

    it('should throw FaqIsolationViolationError if tenant ID does not match', async () => {
      const existingRecord = {
        id: 'faq-1',
        tenantId: 'tenant-1',
      };

      mockRepository.findById.mockResolvedValue(existingRecord);

      await expect(
        service.updateFaq({
          id: 'faq-1',
          tenantId: 'tenant-different',
          question: 'New Question',
          actorId: 'user-123',
          requestId: 'req-456',
        }),
      ).rejects.toThrow(FaqIsolationViolationError);
    });
  });

  describe('getFaqById', () => {
    it('should return FAQ if it exists and tenant ID matches', async () => {
      const mockRecord = {
        id: 'faq-1',
        tenantId: 'tenant-1',
        question: 'Question?',
        answer: 'Answer.',
      };

      mockRepository.findById.mockResolvedValue(mockRecord);

      const result = await service.getFaqById('faq-1', 'tenant-1');
      expect(result.id).toBe('faq-1');
    });
  });

  describe('deleteFaq', () => {
    it('should soft delete FAQ and publish a deleted event', async () => {
      const mockRecord = {
        id: 'faq-1',
        tenantId: 'tenant-1',
        question: 'Question?',
        answer: 'Answer.',
      };

      mockRepository.findById.mockResolvedValue(mockRecord);
      mockRepository.softDelete.mockResolvedValue({
        ...mockRecord,
        deletedAt: new Date(),
      });

      const result = await service.deleteFaq('faq-1', 'tenant-1', 'user-123', 'req-456');
      expect(mockRepository.softDelete).toHaveBeenCalledWith('faq-1');
      expect(mockPublisher.publish).toHaveBeenCalledWith({
        type: EVENT_FAQ_DELETED,
        payload: expect.objectContaining({
          tenantId: 'tenant-1',
          faqId: 'faq-1',
          actorId: 'user-123',
          requestId: 'req-456',
        }),
      });
      expect(result.deletedAt).not.toBeNull();
    });
  });
});

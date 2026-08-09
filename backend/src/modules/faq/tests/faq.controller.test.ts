import { FaqController } from '../controllers/faq.controller';

describe('FaqController Unit Tests', () => {
  let controller: FaqController;
  let mockService: any;
  let mockReq: any;
  let mockRes: any;
  let mockNext: any;

  beforeEach(() => {
    mockService = {
      createFaq: jest.fn(),
      updateFaq: jest.fn(),
      getFaqById: jest.fn(),
      listFaqs: jest.fn(),
      deleteFaq: jest.fn(),
      restoreFaq: jest.fn(),
    };

    controller = new FaqController(mockService);

    mockReq = {
      body: {},
      params: {},
      query: {},
      tenantId: 'tenant-1',
      user: { userId: 'user-123' },
      requestId: 'req-456',
    };

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    mockNext = jest.fn();
  });

  describe('create', () => {
    it('should return 201 and data on success', async () => {
      mockReq.body = {
        question: 'What is your schedule?',
        answer: '9 AM to 5 PM',
      };

      const mockFaq = {
        id: 'faq-1',
        publicId: 'faq_123',
        tenantId: 'tenant-1',
        question: 'What is your schedule?',
        answer: '9 AM to 5 PM',
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      };

      mockService.createFaq.mockResolvedValue(mockFaq);

      await controller.create(mockReq, mockRes, mockNext);

      expect(mockService.createFaq).toHaveBeenCalledWith({
        tenantId: 'tenant-1',
        question: 'What is your schedule?',
        answer: '9 AM to 5 PM',
        actorId: 'user-123',
        requestId: 'req-456',
      });

      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: mockFaq,
      });
    });

    it('should return 422 if payload is invalid', async () => {
      mockReq.body = {
        question: '',
        answer: '',
      };

      await controller.create(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(422);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'VALIDATION_FAILED',
          }),
        }),
      );
    });
  });

  describe('get', () => {
    it('should return 200 and data', async () => {
      mockReq.params = { id: 'faq-1' };
      const mockFaq = { id: 'faq-1', question: 'Q', answer: 'A' };
      mockService.getFaqById.mockResolvedValue(mockFaq);

      await controller.get(mockReq, mockRes, mockNext);

      expect(mockService.getFaqById).toHaveBeenCalledWith('faq-1', 'tenant-1');
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: mockFaq,
      });
    });
  });
});

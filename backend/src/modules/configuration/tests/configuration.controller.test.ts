/**
 * Configuration Controller Unit Tests
 */

import { ConfigurationController } from '../controllers/configuration.controller';
import { ConfigurationError } from '../errors/configuration.errors';

const mockService = {
  getActiveConfiguration: jest.fn(),
  getConfigurationById: jest.fn(),
  listConfigurationHistory: jest.fn(),
  createConfiguration: jest.fn(),
  updateConfiguration: jest.fn(),
  rollbackConfiguration: jest.fn(),
  clearCache: jest.fn(),
};

function makeRequest(overrides: Record<string, unknown> = {}): any {
  return {
    tenantId: '550e8400-e29b-41d4-a716-446655440000',
    requestId: 'req-123',
    user: { userId: 'u-1', tenantId: '550e8400-e29b-41d4-a716-446655440000', role: 'admin', clinicId: null },
    params: {},
    query: {},
    body: {},
    ...overrides,
  };
}

function makeResponse(): any {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.req = {};
  return {
    res,
    status: res.status,
    json: res.json,
  };
}

describe('ConfigurationController', () => {
  let controller: ConfigurationController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new ConfigurationController(mockService as any);
  });

  describe('getActiveConfiguration', () => {
    it('should return 200 and resolved configuration settings on success', async () => {
      const mockResult = { id: 'c-1', version: 1 };
      mockService.getActiveConfiguration.mockResolvedValue(mockResult);

      const req = makeRequest();
      const { res, status, json } = makeResponse();
      const next = jest.fn();

      await controller.getActiveConfiguration(req, res, next);

      expect(mockService.getActiveConfiguration).toHaveBeenCalledWith(
        '550e8400-e29b-41d4-a716-446655440000',
        null,
      );
      expect(status).toHaveBeenCalledWith(200);
      expect(json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: { configuration: mockResult },
        }),
      );
    });

    it('should call next(err) if service throws', async () => {
      const error = new Error('Database down');
      mockService.getActiveConfiguration.mockRejectedValue(error);

      const req = makeRequest();
      const { res } = makeResponse();
      const next = jest.fn();

      await controller.getActiveConfiguration(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('createConfiguration', () => {
    const validBody = {
      clinicId: '550e8400-e29b-41d4-a716-446655440001',
      changeSummary: 'Testing setup creation',
      business: { businessHours: [], holidays: [], appointmentDuration: 30 },
      voice: { voiceModel: 'alloy', greeting: 'Hi', prompt: 'Prompt', language: 'en' },
      ai: { promptAssignment: 'receptionist-prompt', tone: 'professional', greeting: 'Hi', provider: 'openai' },
      calendar: { calendarProvider: 'google', syncIntervalMinutes: 15 },
      notification: { smsEnabled: true, emailEnabled: true },
      branding: { clinicName: 'Smile Care' },
      localization: { language: 'en', country: 'US', timezone: 'UTC', dateFormat: 'YYYY-MM-DD', timeFormat: 'HH:mm' },
      featureFlags: { voiceEnabled: true, aiEnabled: true, callRecordingEnabled: false, smsEnabled: true, emailEnabled: true, analyticsEnabled: false, premiumFeatures: [] },
      providers: { openai: {} },
    };

    it('should validate body, call service, and return 201 on success', async () => {
      mockService.createConfiguration.mockResolvedValue({ id: 'c-1', version: 1 });

      const req = makeRequest({ body: validBody });
      const { res, status, json } = makeResponse();
      const next = jest.fn();

      await controller.createConfiguration(req, res, next);

      expect(mockService.createConfiguration).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: '550e8400-e29b-41d4-a716-446655440000',
          createdBy: 'u-1',
        }),
      );
      expect(status).toHaveBeenCalledWith(201);
      expect(json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
        }),
      );
    });

    it('should return 422 if request payload fails schema validation', async () => {
      const req = makeRequest({ body: { invalid: 'payload' } });
      const { res, status, json } = makeResponse();
      const next = jest.fn();

      await controller.createConfiguration(req, res, next);

      expect(mockService.createConfiguration).not.toHaveBeenCalled();
      expect(status).toHaveBeenCalledWith(422);
      expect(json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({ code: 'VALIDATION_FAILED' }),
        }),
      );
    });
  });
});

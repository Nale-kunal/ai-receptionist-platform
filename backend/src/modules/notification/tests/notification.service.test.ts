/**
 * Notification Service Unit Tests
 */

import { NotificationService, MockSmtpProvider, MockTwilioSmsProvider } from '../services/notification.service';
import {
  NotificationNotFoundError,
  NotificationIsolationViolationError,
  InvalidNotificationStatusTransitionError,
  NotificationAlreadyTerminalError,
  ClinicNotActiveForNotificationError,
  NotificationOwnershipError,
  RecipientValidationFailedError,
  NotificationPreferenceRestrictedError,
  TemplateRenderError,
} from '../errors/notification.errors';
import {
  EVENT_NOTIFICATION_CREATED,
  EVENT_NOTIFICATION_QUEUED,
  EVENT_NOTIFICATION_SENT,
  EVENT_NOTIFICATION_DELIVERED,
  EVENT_NOTIFICATION_FAILED,
  EVENT_NOTIFICATION_RETRIED,
  EVENT_NOTIFICATION_CANCELLED,
  EVENT_TEMPLATE_RENDERED,
} from '../events/notification.events';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockRepository = {
  create: jest.fn(),
  update: jest.fn(),
  findById: jest.fn(),
  findByPublicId: jest.fn(),
  findMany: jest.fn(),
  findPendingForDelivery: jest.fn(),
  getPatientPreferences: jest.fn(),
  updatePatientPreferences: jest.fn(),
  clinicIsActive: jest.fn(),
  patientBelongsToClinic: jest.fn(),
  appointmentBelongsToClinic: jest.fn(),
  conversationBelongsToClinic: jest.fn(),
};

const mockPublisher = { publish: jest.fn() };

// ---------------------------------------------------------------------------
// Test Data
// ---------------------------------------------------------------------------

const TENANT_ID = '550e8400-e29b-41d4-a716-446655440000';
const CLINIC_ID = '550e8400-e29b-41d4-a716-446655440001';
const PATIENT_ID = '550e8400-e29b-41d4-a716-446655440002';
const APPT_ID = '550e8400-e29b-41d4-a716-446655440003';
const NOTIF_ID = '550e8400-e29b-41d4-a716-446655440004';

function makeNotification(overrides: Record<string, unknown> = {}) {
  return {
    id: NOTIF_ID,
    publicId: 'ntf_abc123',
    tenantId: TENANT_ID,
    clinicId: CLINIC_ID,
    patientId: null,
    appointmentId: null,
    conversationId: null,
    recipient: 'test@example.com',
    channel: 'email',
    type: 'appointment_confirmation',
    subject: 'Appointment Confirmed',
    content: 'Hello patient, your appointment has been confirmed.',
    status: 'pending',
    provider: null,
    retryCount: 0,
    maxRetries: 3,
    failureReason: null,
    scheduledAt: null,
    sentAt: null,
    deliveredAt: null,
    failedAt: null,
    variables: {},
    metadata: {},
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...overrides,
  };
}

function setupHappyPath() {
  mockRepository.clinicIsActive.mockResolvedValue(true);
  mockRepository.patientBelongsToClinic.mockResolvedValue(true);
  mockRepository.appointmentBelongsToClinic.mockResolvedValue(true);
  mockRepository.conversationBelongsToClinic.mockResolvedValue(true);
  mockRepository.getPatientPreferences.mockResolvedValue({
    smsEnabled: true,
    emailEnabled: true,
    preferredLanguage: 'en',
    preferredContactMethod: 'email',
  });
  mockRepository.create.mockResolvedValue(makeNotification());
  mockRepository.findById.mockResolvedValue(makeNotification());
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('NotificationService', () => {
  let service: NotificationService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new NotificationService(mockRepository as any, mockPublisher as any);
  });

  describe('createNotification', () => {
    const params = {
      tenantId: TENANT_ID,
      clinicId: CLINIC_ID,
      recipient: 'test@example.com',
      channel: 'email' as const,
      type: 'appointment_confirmation' as const,
      templateName: 'appointment_confirmation',
      variables: { patientName: 'John', doctorName: 'Smith', appointmentDate: '2025-01-01', appointmentTime: '10:00 AM' },
      actorId: 'actor-1',
      requestId: 'req-1',
    };

    it('should create notification successfully when preferences and formats are valid', async () => {
      setupHappyPath();

      const result = await service.createNotification(params);

      expect(mockRepository.clinicIsActive).toHaveBeenCalledWith(CLINIC_ID, TENANT_ID);
      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'pending',
          recipient: 'test@example.com',
        }),
      );
      expect(mockPublisher.publish).toHaveBeenCalledWith(
        expect.objectContaining({ type: EVENT_NOTIFICATION_CREATED }),
      );
      expect(mockPublisher.publish).toHaveBeenCalledWith(
        expect.objectContaining({ type: EVENT_TEMPLATE_RENDERED }),
      );
      expect(result.id).toBe(NOTIF_ID);
    });

    it('should throw ClinicNotActiveForNotificationError when clinic is inactive', async () => {
      mockRepository.clinicIsActive.mockResolvedValue(false);
      await expect(service.createNotification(params)).rejects.toThrow(ClinicNotActiveForNotificationError);
    });

    it('should throw RecipientValidationFailedError when email format is invalid', async () => {
      mockRepository.clinicIsActive.mockResolvedValue(true);
      await expect(
        service.createNotification({ ...params, recipient: 'invalid-email' }),
      ).rejects.toThrow(RecipientValidationFailedError);
    });

    it('should throw RecipientValidationFailedError when SMS format is invalid', async () => {
      mockRepository.clinicIsActive.mockResolvedValue(true);
      await expect(
        service.createNotification({ ...params, channel: 'sms', recipient: 'invalid-phone' }),
      ).rejects.toThrow(RecipientValidationFailedError);
    });

    it('should throw NotificationPreferenceRestrictedError when patient disabled target channel', async () => {
      setupHappyPath();
      mockRepository.getPatientPreferences.mockResolvedValue({
        smsEnabled: false,
        emailEnabled: true,
        preferredLanguage: 'en',
        preferredContactMethod: 'email',
      });

      await expect(
        service.createNotification({ ...params, patientId: PATIENT_ID, channel: 'sms', recipient: '+1234567890' }),
      ).rejects.toThrow(NotificationPreferenceRestrictedError);
    });

    it('should throw TemplateRenderError when templateName is unknown', async () => {
      setupHappyPath();
      await expect(
        service.createNotification({ ...params, templateName: 'unknown_template' }),
      ).rejects.toThrow(TemplateRenderError);
    });
  });

  describe('sendImmediate', () => {
    it('should process pending -> queued -> sending -> sent -> delivered on success', async () => {
      setupHappyPath();
      mockRepository.findById.mockResolvedValue(makeNotification({ status: 'pending' }));
      mockRepository.update
        .mockResolvedValueOnce(makeNotification({ status: 'queued' }))
        .mockResolvedValueOnce(makeNotification({ status: 'sending' }))
        .mockResolvedValueOnce(makeNotification({ status: 'sent' }))
        .mockResolvedValueOnce(makeNotification({ status: 'delivered', deliveredAt: new Date() }));

      const result = await service.sendImmediate(NOTIF_ID, TENANT_ID, 'actor-1', 'req-1');

      expect(result.status).toBe('delivered');
      expect(mockPublisher.publish).toHaveBeenCalledWith(
        expect.objectContaining({ type: EVENT_NOTIFICATION_DELIVERED }),
      );
    });

    it('should transition to failed and schedule retry if retryable error occurs', async () => {
      setupHappyPath();
      mockRepository.findById.mockResolvedValue(makeNotification({ status: 'pending', recipient: 'fail@example.com' }));
      mockRepository.update
        .mockResolvedValueOnce(makeNotification({ status: 'queued', recipient: 'fail@example.com' }))
        .mockResolvedValueOnce(makeNotification({ status: 'sending', recipient: 'fail@example.com' }))
        .mockResolvedValueOnce(makeNotification({ status: 'failed', recipient: 'fail@example.com', retryCount: 0, maxRetries: 3 }))
        .mockResolvedValueOnce(makeNotification({ status: 'queued', recipient: 'fail@example.com', retryCount: 1 }));

      const result = await service.sendImmediate(NOTIF_ID, TENANT_ID, 'actor-1', 'req-1');

      expect(result.status).toBe('queued');
      expect(result.retryCount).toBe(1);
      expect(mockPublisher.publish).toHaveBeenCalledWith(
        expect.objectContaining({ type: EVENT_NOTIFICATION_RETRIED }),
      );
    });
  });

  describe('cancelNotification', () => {
    it('should mark pending notification as cancelled', async () => {
      setupHappyPath();
      mockRepository.findById.mockResolvedValue(makeNotification({ status: 'pending' }));
      mockRepository.update.mockResolvedValue(makeNotification({ status: 'cancelled' }));

      const result = await service.cancelNotification(NOTIF_ID, TENANT_ID, 'actor-1', 'req-1');

      expect(result.status).toBe('cancelled');
      expect(mockPublisher.publish).toHaveBeenCalledWith(
        expect.objectContaining({ type: EVENT_NOTIFICATION_CANCELLED }),
      );
    });

    it('should throw NotificationAlreadyTerminalError when trying to cancel delivered notification', async () => {
      setupHappyPath();
      mockRepository.findById.mockResolvedValue(makeNotification({ status: 'delivered' }));

      await expect(
        service.cancelNotification(NOTIF_ID, TENANT_ID, 'actor-1', 'req-1'),
      ).rejects.toThrow(NotificationAlreadyTerminalError);
    });
  });
});

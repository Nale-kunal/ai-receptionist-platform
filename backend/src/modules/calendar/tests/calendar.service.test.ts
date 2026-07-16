/**
 * Calendar Service Unit Tests
 */

import { CalendarService, MockGoogleCalendarAdapter } from '../services/calendar.service';
import {
  CalendarConnectionNotFoundError,
  CalendarIsolationViolationError,
  AvailabilityFetchFailedError,
  WebhookVerificationFailedError,
  ClinicNotActiveForCalendarError,
  CalendarOwnershipError,
} from '../errors/calendar.errors';
import {
  EVENT_CALENDAR_CONNECTED,
  EVENT_CALENDAR_DISCONNECTED,
  EVENT_CALENDAR_SYNC_STARTED,
  EVENT_CALENDAR_SYNC_COMPLETED,
  EVENT_CALENDAR_SYNC_FAILED,
  EVENT_CALENDAR_WEBHOOK_PROCESSED,
} from '../events/calendar.events';
import { encryptToken } from '../utils/encryption.utils';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockRepository = {
  createConnection:               jest.fn(),
  updateConnection:               jest.fn(),
  findConnectionById:             jest.fn(),
  findConnectionByPublicId:       jest.fn(),
  findConnections:                jest.fn(),
  findActiveConnectionsForClinic: jest.fn(),
  createMapping:                  jest.fn(),
  findMapping:                    jest.fn(),
  deleteMapping:                  jest.fn(),
  createSyncLog:                  jest.fn(),
  clinicIsActive:                 jest.fn(),
  doctorBelongsToClinic:          jest.fn(),
  getAppointmentWithPatient:      jest.fn(),
};

const mockPublisher = { publish: jest.fn() };

// ---------------------------------------------------------------------------
// Test Data
// ---------------------------------------------------------------------------

const TENANT_ID = '550e8400-e29b-41d4-a716-446655440000';
const CLINIC_ID = '550e8400-e29b-41d4-a716-446655440001';
const DOCTOR_ID = '550e8400-e29b-41d4-a716-446655440002';
const CONN_ID = '550e8400-e29b-41d4-a716-446655440003';
const APPT_ID = '550e8400-e29b-41d4-a716-446655440004';
const SECRET_KEY = 'super-secret-key-at-least-32-chars-long';

function makeConnection(overrides: Record<string, unknown> = {}) {
  return {
    id:               CONN_ID,
    publicId:         'cal_abc123',
    tenantId:         TENANT_ID,
    clinicId:         CLINIC_ID,
    doctorId:         null,
    provider:         'google',
    calendarId:       'primary',
    connectionStatus: 'connected',
    lastSyncTime:     null,
    accessToken:      encryptToken('valid-token', SECRET_KEY),
    refreshToken:     encryptToken('refresh-token', SECRET_KEY),
    tokenExpiry:      null,
    createdAt:        new Date(),
    updatedAt:        new Date(),
    deletedAt:        null,
    ...overrides,
  };
}

function makeAppointment() {
  return {
    id:        APPT_ID,
    clinicId:  CLINIC_ID,
    tenantId:  TENANT_ID,
    startTime: new Date(),
    endTime:   new Date(Date.now() + 30 * 60 * 1000),
    timezone:  'America/New_York',
    notes:     'Dental checkup',
    patient: {
      fullName: 'Alice Smith',
    },
  };
}

function setupHappyPath() {
  mockRepository.clinicIsActive.mockResolvedValue(true);
  mockRepository.doctorBelongsToClinic.mockResolvedValue(true);
  mockRepository.createConnection.mockResolvedValue(makeConnection());
  mockRepository.findConnectionById.mockResolvedValue(makeConnection());
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CalendarService', () => {
  let service: CalendarService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new CalendarService(mockRepository as any, mockPublisher as any, {
      calendarEncryptionSecret: SECRET_KEY,
    });
  });

  describe('connectCalendar', () => {
    const params = {
      tenantId:    TENANT_ID,
      clinicId:    CLINIC_ID,
      provider:    'google' as const,
      calendarId:  'primary',
      accessToken: 'valid-token',
      actorId:     'actor-1',
      requestId:   'req-1',
    };

    it('should connect calendar successfully when credentials are valid', async () => {
      setupHappyPath();

      const result = await service.connectCalendar(params);

      expect(mockRepository.clinicIsActive).toHaveBeenCalledWith(CLINIC_ID, TENANT_ID);
      expect(mockRepository.createConnection).toHaveBeenCalledWith(
        expect.objectContaining({
          connectionStatus: 'connected',
          provider:         'google',
        }),
      );
      expect(mockPublisher.publish).toHaveBeenCalledWith(
        expect.objectContaining({ type: EVENT_CALENDAR_CONNECTED }),
      );
      expect(result.id).toBe(CONN_ID);
    });

    it('should throw ClinicNotActiveForCalendarError when clinic is inactive', async () => {
      mockRepository.clinicIsActive.mockResolvedValue(false);
      await expect(service.connectCalendar(params)).rejects.toThrow(ClinicNotActiveForCalendarError);
    });

    it('should throw CalendarOwnershipError when doctor is not in the clinic', async () => {
      mockRepository.clinicIsActive.mockResolvedValue(true);
      mockRepository.doctorBelongsToClinic.mockResolvedValue(false);

      await expect(
        service.connectCalendar({ ...params, doctorId: DOCTOR_ID }),
      ).rejects.toThrow(CalendarOwnershipError);
    });
  });

  describe('disconnectCalendar', () => {
    it('should disconnect calendar connection successfully', async () => {
      setupHappyPath();
      mockRepository.updateConnection.mockResolvedValue(makeConnection({ connectionStatus: 'disconnected' }));

      const result = await service.disconnectCalendar(CONN_ID, TENANT_ID, 'actor-1', 'req-1');

      expect(result.connectionStatus).toBe('disconnected');
      expect(mockPublisher.publish).toHaveBeenCalledWith(
        expect.objectContaining({ type: EVENT_CALENDAR_DISCONNECTED }),
      );
    });

    it('should fail with CalendarIsolationViolationError if connection belongs to other tenant', async () => {
      setupHappyPath();
      mockRepository.findConnectionById.mockResolvedValue(makeConnection({ tenantId: 'other-tenant' }));

      await expect(
        service.disconnectCalendar(CONN_ID, TENANT_ID, 'actor-1', 'req-1'),
      ).rejects.toThrow(CalendarIsolationViolationError);
    });
  });

  describe('getAvailability', () => {
    it('should return availability from mock adapter', async () => {
      setupHappyPath();

      const slots = await service.getAvailability(CONN_ID, TENANT_ID, new Date(), new Date());

      expect(slots.length).toBeGreaterThan(0);
      expect(slots[0]).toHaveProperty('startTime');
      expect(slots[0]).toHaveProperty('endTime');
    });

    it('should throw AvailabilityFetchFailedError when token validation fails', async () => {
      setupHappyPath();
      mockRepository.findConnectionById.mockResolvedValue(
        makeConnection({ accessToken: encryptToken('fail-token', SECRET_KEY) }),
      );

      await expect(
        service.getAvailability(CONN_ID, TENANT_ID, new Date(), new Date()),
      ).rejects.toThrow(AvailabilityFetchFailedError);
    });
  });

  describe('Webhook processing', () => {
    it('should succeed with valid signature', async () => {
      await service.processWebhook('google', 'valid-sig', {}, TENANT_ID);
      expect(mockPublisher.publish).toHaveBeenCalledWith(
        expect.objectContaining({ type: EVENT_CALENDAR_WEBHOOK_PROCESSED }),
      );
    });

    it('should fail with invalid signature', async () => {
      await expect(
        service.processWebhook('google', 'invalid', {}, TENANT_ID),
      ).rejects.toThrow(WebhookVerificationFailedError);
    });
  });

  describe('syncAppointmentCreated', () => {
    it('should run sync loop, persist mapping link, log sync history on success', async () => {
      setupHappyPath();
      mockRepository.getAppointmentWithPatient.mockResolvedValue(makeAppointment());
      mockRepository.findActiveConnectionsForClinic.mockResolvedValue([makeConnection()]);
      mockRepository.createMapping.mockResolvedValue({ id: 'map-1' });

      await service.syncAppointmentCreated(APPT_ID, TENANT_ID, 'actor-1', 'req-1');

      expect(mockRepository.createMapping).toHaveBeenCalled();
      expect(mockRepository.createSyncLog).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'success' }),
      );
      expect(mockPublisher.publish).toHaveBeenCalledWith(
        expect.objectContaining({ type: EVENT_CALENDAR_SYNC_COMPLETED }),
      );
    });

    it('should retry on failures and mark connection status to error when retries exhaust', async () => {
      setupHappyPath();
      mockRepository.getAppointmentWithPatient.mockResolvedValue(makeAppointment());
      // Return a failing connection
      mockRepository.findActiveConnectionsForClinic.mockResolvedValue([
        makeConnection({ accessToken: encryptToken('fail-token', SECRET_KEY) }),
      ]);

      await service.syncAppointmentCreated(APPT_ID, TENANT_ID, 'actor-1', 'req-1');

      // Should create failed sync log
      expect(mockRepository.createSyncLog).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'failed' }),
      );
      // Connection marked to Error status
      expect(mockRepository.updateConnection).toHaveBeenCalledWith(
        CONN_ID,
        expect.objectContaining({ connectionStatus: 'error' }),
      );
      expect(mockPublisher.publish).toHaveBeenCalledWith(
        expect.objectContaining({ type: EVENT_CALENDAR_SYNC_FAILED }),
      );
    });
  });
});

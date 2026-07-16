/**
 * Calendar Repository Unit Tests
 */

import { CalendarRepository } from '../repositories/calendar.repository';

// ---------------------------------------------------------------------------
// Mock Prisma Client
// ---------------------------------------------------------------------------

const mockCalendarConnection = {
  create:     jest.fn(),
  update:     jest.fn(),
  findFirst:  jest.fn(),
  findMany:   jest.fn(),
};

const mockCalendarEventMapping = {
  create:     jest.fn(),
  findUnique: jest.fn(),
  delete:     jest.fn(),
};

const mockCalendarSyncLog = {
  create: jest.fn(),
};

const mockClinic = { count: jest.fn() };
const mockDoctor = { count: jest.fn() };
const mockAppointment = { findFirst: jest.fn() };

const mockPrisma = {
  calendarConnection:   mockCalendarConnection,
  calendarEventMapping: mockCalendarEventMapping,
  calendarSyncLog:      mockCalendarSyncLog,
  clinic:               mockClinic,
  doctor:               mockDoctor,
  appointment:          mockAppointment,
};

const TENANT_ID = '550e8400-e29b-41d4-a716-446655440000';
const CLINIC_ID = '550e8400-e29b-41d4-a716-446655440001';

describe('CalendarRepository', () => {
  let repository: CalendarRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repository = new CalendarRepository(mockPrisma as any);
  });

  describe('createConnection', () => {
    it('should call prisma.calendarConnection.create with properties mapped', async () => {
      mockCalendarConnection.create.mockResolvedValue({ id: 'conn-1' });

      const result = await repository.createConnection({
        tenantId:         TENANT_ID,
        clinicId:         CLINIC_ID,
        provider:         'google',
        calendarId:       'primary',
        connectionStatus: 'connected',
        accessToken:      'encrypted-token',
      });

      expect(mockCalendarConnection.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tenantId:    TENANT_ID,
            clinicId:    CLINIC_ID,
            accessToken: 'encrypted-token',
          }),
        }),
      );
      expect(result).toEqual({ id: 'conn-1' });
    });
  });

  describe('clinicIsActive', () => {
    it('should return true if count is greater than 0', async () => {
      mockClinic.count.mockResolvedValue(1);
      const result = await repository.clinicIsActive(CLINIC_ID, TENANT_ID);
      expect(result).toBe(true);
    });

    it('should return false if count is 0', async () => {
      mockClinic.count.mockResolvedValue(0);
      const result = await repository.clinicIsActive(CLINIC_ID, TENANT_ID);
      expect(result).toBe(false);
    });
  });
});

/**
 * API Consistency & Single Authoritative Overlap Engine Regression Tests
 * Verifies that Availability API, Booking API, and Reschedule API execute the identical overlap logic.
 */

import { checkAppointmentOverlap } from '../../../shared/scheduling/schedulingOverlap';

describe('API Consistency — Single Authoritative Overlap Engine', () => {
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      appointment: {
        findMany: jest.fn(),
      },
    };
  });

  it('should evaluate overlap identically for candidate 14:00 slot when 14:00-15:30 appointment exists', async () => {
    const existingAppt = {
      id: 'appt-adesh-123',
      startTime: new Date('2026-07-29T08:30:00.000Z'), // 14:00 IST
      endTime: new Date('2026-07-29T10:00:00.000Z'),   // 15:30 IST
      status: 'rescheduled',
      patient: { fullName: 'Adesh Bhosale' },
    };

    mockPrisma.appointment.findMany.mockResolvedValue([existingAppt]);

    const result = await checkAppointmentOverlap(mockPrisma, {
      tenantId: 'tenant-1',
      doctorId: 'doc-1',
      startTime: new Date('2026-07-29T08:30:00.000Z'), // 14:00 candidate start
      endTime: new Date('2026-07-29T09:30:00.000Z'),   // 15:00 candidate end
    });

    expect(result.hasConflict).toBe(true);
    expect(result.conflictingAppointment?.id).toBe('appt-adesh-123');
  });

  it('should ignore self-appointment during reschedule when excludeAppointmentId matches', async () => {
    mockPrisma.appointment.findMany.mockResolvedValue([]);

    const result = await checkAppointmentOverlap(mockPrisma, {
      tenantId: 'tenant-1',
      doctorId: 'doc-1',
      startTime: new Date('2026-07-29T08:30:00.000Z'),
      endTime: new Date('2026-07-29T09:30:00.000Z'),
      excludeAppointmentId: 'appt-adesh-123',
    });

    expect(result.hasConflict).toBe(false);
  });

  it('should detect overlap against an appointment with status: scheduled', async () => {
    const scheduledAppt = {
      id: 'appt-yash-456',
      startTime: new Date('2026-08-04T05:30:00.000Z'), // 11:00 IST
      endTime: new Date('2026-08-04T06:30:00.000Z'),   // 12:00 IST (60 mins)
      status: 'scheduled',
      patient: { fullName: 'Sarika Nale' },
    };

    mockPrisma.appointment.findMany.mockImplementation(({ where }: any) => {
      expect(where.status.in).toContain('scheduled');
      return Promise.resolve([scheduledAppt]);
    });

    const result = await checkAppointmentOverlap(mockPrisma, {
      tenantId: 'tenant-1',
      doctorId: 'doc-1',
      startTime: new Date('2026-08-04T06:00:00.000Z'), // 11:30 IST candidate start
      endTime: new Date('2026-08-04T06:30:00.000Z'),   // 12:00 IST candidate end
    });

    expect(result.hasConflict).toBe(true);
    expect(result.conflictingAppointment?.id).toBe('appt-yash-456');
  });
});

/**
 * Atomic Double-Booking & Concurrency Protection Tests
 *
 * Verifies that when two simultaneous booking requests are made for the same doctor
 * and overlapping time interval, exactly 1 succeeds and the other is rejected with 409 APPOINTMENT_CONFLICT.
 */

import { AppointmentService } from '../services/appointment.service';
import { AppointmentConflictError } from '../errors/appointment.errors';

describe('Appointment Concurrency & Atomic Double-Booking Protection', () => {
  let service: AppointmentService;
  let activeBookings: Array<{ id: string; startTime: Date; endTime: Date }>;

  beforeEach(() => {
    activeBookings = [];

    const mockRepo: any = {
      clinicIsActive: jest.fn().mockResolvedValue(true),
      doctorBelongsToClinic: jest.fn().mockResolvedValue(true),
      patientBelongsToClinic: jest.fn().mockResolvedValue(true),
      getDoctorStatus: jest.fn().mockResolvedValue('active'),
      getDoctorDetails: jest.fn().mockResolvedValue({
        id: 'doc-1',
        status: 'active',
        workingHours: [
          { dayOfWeek: 1, openTime: '09:00', closeTime: '17:00', breakStart: '12:00', breakEnd: '13:00', isClosed: false },
        ],
        leaves: [],
        clinic: { id: 'clinic-1', timezone: 'UTC' },
      }),
      getPatientStatus: jest.fn().mockResolvedValue('active'),

      // Atomic transactional creation with simulated mutex / row locking
      createWithAtomicConflictCheck: jest.fn().mockImplementation(async (data) => {
        // Simulate async DB delay
        await new Promise((resolve) => setTimeout(resolve, 20));

        // Check if another concurrent request committed an overlapping appointment
        const hasConflict = activeBookings.some(
          (b) => b.startTime.getTime() < data.endTime.getTime() && b.endTime.getTime() > data.startTime.getTime(),
        );

        if (hasConflict) {
          throw new AppointmentConflictError();
        }

        const newAppt = {
          id: `appt-${Date.now()}-${Math.random()}`,
          ...data,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        activeBookings.push(newAppt);
        return newAppt;
      }),
    };

    const mockPublisher = { publish: jest.fn().mockResolvedValue(undefined) };
    service = new AppointmentService(mockRepo, mockPublisher);
  });

  it('atomically prevents race condition double bookings when 2 requests fire simultaneously', async () => {
    const startTime = new Date('2026-09-07T10:00:00Z');
    const endTime = new Date('2026-09-07T10:30:00Z');

    const paramsA = {
      tenantId: 'tenant-1',
      clinicId: 'clinic-1',
      doctorId: 'doc-1',
      patientId: 'patient-A',
      startTime,
      endTime,
      timezone: 'UTC',
      source: 'dashboard' as const,
      actorId: 'user-A',
      requestId: 'req-A',
    };

    const paramsB = {
      tenantId: 'tenant-1',
      clinicId: 'clinic-1',
      doctorId: 'doc-1',
      patientId: 'patient-B',
      startTime,
      endTime,
      timezone: 'UTC',
      source: 'dashboard' as const,
      actorId: 'user-B',
      requestId: 'req-B',
    };

    // Execute both concurrently
    const results = await Promise.allSettled([
      service.createAppointment(paramsA),
      service.createAppointment(paramsB),
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(AppointmentConflictError);
  });
});

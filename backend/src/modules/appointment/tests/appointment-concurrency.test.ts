/**
 * Appointment Concurrency & Double-Booking Prevention Integration Tests
 */

import { AppointmentService } from '../services/appointment.service';
import { AppointmentConflictError } from '../errors/appointment.errors';

describe('Appointment Concurrency & Double-Booking Protection', () => {
  let service: AppointmentService;
  let mockRepo: any;
  let mockPublisher: any;

  beforeEach(() => {
    mockRepo = {
      clinicIsActive: jest.fn().mockResolvedValue(true),
      doctorBelongsToClinic: jest.fn().mockResolvedValue(true),
      getDoctorStatus: jest.fn().mockResolvedValue('active'),
      patientBelongsToClinic: jest.fn().mockResolvedValue(true),
      getPatientStatus: jest.fn().mockResolvedValue('active'),
      findConflicts: jest.fn(),
      create: jest.fn(),
    };

    mockPublisher = {
      publish: jest.fn().mockResolvedValue(undefined),
    };

    service = new AppointmentService(mockRepo, mockPublisher);
  });

  it('should reject overlapping appointment booking with AppointmentConflictError', async () => {
    const startTime = new Date('2026-08-01T10:00:00Z');
    const endTime = new Date('2026-08-01T10:30:00Z');

    // Simulate existing conflicting appointment found in DB
    mockRepo.findConflicts.mockResolvedValueOnce([{ id: 'existing-appt-123' }]);

    await expect(
      service.createAppointment({
        tenantId: 'tenant-1',
        clinicId: 'clinic-1',
        doctorId: 'doctor-1',
        patientId: 'patient-1',
        startTime,
        endTime,
        timezone: 'UTC',
        source: 'dashboard',
        actorId: 'user-1',
        requestId: 'req-1',
      }),
    ).rejects.toThrow(AppointmentConflictError);

    expect(mockRepo.create).not.toHaveBeenCalled();
  });

  it('should allow booking when no overlapping slots exist', async () => {
    const startTime = new Date('2026-08-01T11:00:00Z');
    const endTime = new Date('2026-08-01T11:30:00Z');

    mockRepo.findConflicts.mockResolvedValueOnce([]);
    mockRepo.create.mockResolvedValueOnce({
      id: 'appt-999',
      publicId: 'appt_pub_999',
      tenantId: 'tenant-1',
      clinicId: 'clinic-1',
      doctorId: 'doctor-1',
      patientId: 'patient-1',
      startTime,
      endTime,
      timezone: 'UTC',
      status: 'scheduled',
      source: 'dashboard',
      createdAt: new Date(),
      updatedAt: new Date(),
      patient: { fullName: 'Jane Doe', phone: '+15551234' },
      doctor: { fullName: 'Dr. Smith' },
    });

    const result = await service.createAppointment({
      tenantId: 'tenant-1',
      clinicId: 'clinic-1',
      doctorId: 'doctor-1',
      patientId: 'patient-1',
      startTime,
      endTime,
      timezone: 'UTC',
      source: 'dashboard',
      actorId: 'user-1',
      requestId: 'req-1',
    });

    expect(result.id).toBe('appt-999');
    expect(mockRepo.create).toHaveBeenCalledTimes(1);
    expect(mockPublisher.publish).toHaveBeenCalledTimes(1);
  });
});

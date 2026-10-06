/**
 * Appointment Service Unit Tests
 */

import { AppointmentService } from '../services/appointment.service';
import {
  AppointmentNotFoundError,
  AppointmentConflictError,
  AppointmentIsolationViolationError,
  InvalidAppointmentStatusTransitionError,
  AppointmentAlreadyTerminalError,
  DoctorNotAvailableError,
  DoctorBreakConflictError,
  DoctorScheduleClosedError,
  AppointmentOutsideWorkingHoursError,
  DoctorOnLeaveError,
  PatientNotActiveError,
  ClinicNotActiveError,
  AppointmentOwnershipError,
  AppointmentTimeRangeError,
} from '../errors/appointment.errors';
import {
  EVENT_APPOINTMENT_CREATED,
  EVENT_APPOINTMENT_UPDATED,
  EVENT_APPOINTMENT_CONFIRMED,
  EVENT_APPOINTMENT_CHECKED_IN,
  EVENT_APPOINTMENT_IN_PROGRESS,
  EVENT_APPOINTMENT_CANCELLED,
  EVENT_APPOINTMENT_RESCHEDULED,
  EVENT_APPOINTMENT_COMPLETED,
  EVENT_APPOINTMENT_NO_SHOW,
} from '../events/appointment.events';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockRepository = {
  create:                jest.fn(),
  update:                jest.fn(),
  findById:              jest.fn(),
  findByPublicId:        jest.fn(),
  findMany:              jest.fn(),
  countMany:             jest.fn(),
  getStatusCounters:     jest.fn(),
  findConflicts:         jest.fn(),
  doctorBelongsToClinic: jest.fn(),
  patientBelongsToClinic:jest.fn(),
  clinicIsActive:        jest.fn(),
  getDoctorStatus:       jest.fn(),
  getDoctorDetails:      jest.fn(),
  getPatientStatus:      jest.fn(),
  getDoctorClinicId:     jest.fn(),
  findMainClinicForTenant: jest.fn(),
};

const mockPublisher = { publish: jest.fn() };

// ---------------------------------------------------------------------------
// Test Data
// ---------------------------------------------------------------------------

const TENANT_ID = '550e8400-e29b-41d4-a716-446655440000';
const CLINIC_ID = '550e8400-e29b-41d4-a716-446655440001';
const DOCTOR_ID = '550e8400-e29b-41d4-a716-446655440002';
const PATIENT_ID = '550e8400-e29b-41d4-a716-446655440003';
const APPT_ID = '550e8400-e29b-41d4-a716-446655440004';

// 2025-01-01 is a Wednesday (dayOfWeek: 3)
const START = new Date('2025-01-01T09:00:00Z');
const END   = new Date('2025-01-01T09:30:00Z');

function makeAppt(overrides: Record<string, unknown> = {}) {
  return {
    id:                 APPT_ID,
    publicId:           'appt_abc123',
    tenantId:           TENANT_ID,
    clinicId:           CLINIC_ID,
    doctorId:           DOCTOR_ID,
    patientId:          PATIENT_ID,
    startTime:          START,
    endTime:            END,
    timezone:           'UTC',
    status:             'pending',
    source:             'dashboard',
    notes:              null,
    cancellationReason: null,
    cancelledAt:        null,
    createdAt:          new Date(),
    updatedAt:          new Date(),
    deletedAt:          null,
    ...overrides,
  };
}

function setupHappyPath() {
  mockRepository.clinicIsActive.mockResolvedValue(true);
  mockRepository.doctorBelongsToClinic.mockResolvedValue(true);
  mockRepository.getDoctorStatus.mockResolvedValue('active');
  mockRepository.getDoctorDetails.mockResolvedValue({
    id: DOCTOR_ID,
    status: 'active',
    workingHours: [
      {
        dayOfWeek: 3, // Wednesday
        openTime: '08:00',
        closeTime: '18:00',
        breakStart: '12:00',
        breakEnd: '13:00',
        isClosed: false,
      },
      {
        dayOfWeek: 5, // Friday
        openTime: '08:00',
        closeTime: '18:00',
        breakStart: '12:00',
        breakEnd: '13:00',
        isClosed: false,
      },
    ],
    leaves: [],
    clinic: { id: CLINIC_ID, timezone: 'UTC' },
  });
  mockRepository.patientBelongsToClinic.mockResolvedValue(true);
  mockRepository.getPatientStatus.mockResolvedValue('active');
  mockRepository.findConflicts.mockResolvedValue([]);
  mockRepository.create.mockResolvedValue(makeAppt());
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AppointmentService', () => {
  let service: AppointmentService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AppointmentService(mockRepository as any, mockPublisher as any);
  });

  // -------------------------------------------------------------------------
  // createAppointment
  // -------------------------------------------------------------------------

  describe('createAppointment', () => {
    const params = {
      tenantId: TENANT_ID,
      clinicId: CLINIC_ID,
      doctorId: DOCTOR_ID,
      patientId: PATIENT_ID,
      startTime: START,
      endTime:   END,
      timezone:  'UTC',
      source:    'dashboard' as const,
      actorId:   'actor-1',
      requestId: 'req-1',
    };

    it('should book successfully when all validations pass', async () => {
      setupHappyPath();

      const result = await service.createAppointment(params);

      expect(mockRepository.clinicIsActive).toHaveBeenCalledWith(CLINIC_ID, TENANT_ID);
      expect(mockRepository.doctorBelongsToClinic).toHaveBeenCalledWith(DOCTOR_ID, CLINIC_ID, TENANT_ID);
      expect(mockRepository.patientBelongsToClinic).toHaveBeenCalledWith(PATIENT_ID, CLINIC_ID, TENANT_ID);
      expect(mockRepository.getPatientStatus).toHaveBeenCalledWith(PATIENT_ID);
      expect(mockRepository.findConflicts).toHaveBeenCalled();
      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ status: expect.stringMatching(/scheduled|pending/) }),
      );
      expect(mockPublisher.publish).toHaveBeenCalledWith(
        expect.objectContaining({ type: EVENT_APPOINTMENT_CREATED }),
      );
      expect(result.id).toBe(APPT_ID);
    });

    it('should throw DoctorBreakConflictError when booking during lunch (12:00 - 13:00)', async () => {
      setupHappyPath();
      await expect(
        service.createAppointment({
          ...params,
          startTime: new Date('2025-01-01T12:00:00Z'),
          endTime:   new Date('2025-01-01T12:30:00Z'),
        }),
      ).rejects.toThrow(DoctorBreakConflictError);
    });

    it('should throw DoctorScheduleClosedError when doctor is closed on that day', async () => {
      setupHappyPath();
      // 2025-01-04 is a Saturday (closed)
      await expect(
        service.createAppointment({
          ...params,
          startTime: new Date('2025-01-04T10:00:00Z'),
          endTime:   new Date('2025-01-04T10:30:00Z'),
        }),
      ).rejects.toThrow(DoctorScheduleClosedError);
    });

    it('should throw AppointmentOutsideWorkingHoursError when booking before opening time', async () => {
      setupHappyPath();
      await expect(
        service.createAppointment({
          ...params,
          startTime: new Date('2025-01-01T07:00:00Z'),
          endTime:   new Date('2025-01-01T07:30:00Z'),
        }),
      ).rejects.toThrow(AppointmentOutsideWorkingHoursError);
    });

    it('should throw DoctorOnLeaveError when doctor is on leave', async () => {
      setupHappyPath();
      mockRepository.getDoctorDetails.mockResolvedValue({
        id: DOCTOR_ID,
        status: 'active',
        workingHours: [{ dayOfWeek: 3, openTime: '08:00', closeTime: '18:00', isClosed: false }],
        leaves: [{ startDate: '2025-01-01', endDate: '2025-01-02', reason: 'Vacation' }],
        clinic: { id: CLINIC_ID, timezone: 'UTC' },
      });

      await expect(service.createAppointment(params)).rejects.toThrow(DoctorOnLeaveError);
    });

    it('should throw AppointmentTimeRangeError when endTime <= startTime', async () => {
      await expect(
        service.createAppointment({ ...params, endTime: START }),
      ).rejects.toThrow(AppointmentTimeRangeError);
    });

    it('should throw ClinicNotActiveError when clinic is not active', async () => {
      mockRepository.clinicIsActive.mockResolvedValue(false);
      await expect(service.createAppointment(params)).rejects.toThrow(ClinicNotActiveError);
    });

    it('should throw AppointmentOwnershipError when doctor does not belong to clinic', async () => {
      mockRepository.clinicIsActive.mockResolvedValue(true);
      mockRepository.doctorBelongsToClinic.mockResolvedValue(false);
      await expect(service.createAppointment(params)).rejects.toThrow(AppointmentOwnershipError);
    });

    it('should throw DoctorNotAvailableError when doctor is inactive', async () => {
      mockRepository.clinicIsActive.mockResolvedValue(true);
      mockRepository.doctorBelongsToClinic.mockResolvedValue(true);
      mockRepository.getDoctorStatus.mockResolvedValue('inactive');
      mockRepository.getDoctorDetails.mockResolvedValue({ id: DOCTOR_ID, status: 'inactive' });
      await expect(service.createAppointment(params)).rejects.toThrow(DoctorNotAvailableError);
    });

    it('should throw AppointmentOwnershipError when patient does not belong to clinic', async () => {
      setupHappyPath();
      mockRepository.patientBelongsToClinic.mockResolvedValue(false);
      await expect(service.createAppointment(params)).rejects.toThrow(AppointmentOwnershipError);
    });

    it('should throw PatientNotActiveError when patient is inactive', async () => {
      setupHappyPath();
      mockRepository.getPatientStatus.mockResolvedValue('inactive');
      await expect(service.createAppointment(params)).rejects.toThrow(PatientNotActiveError);
    });

    it('should throw AppointmentConflictError when slot is already taken', async () => {
      setupHappyPath();
      mockRepository.findConflicts.mockResolvedValue([makeAppt()]);
      await expect(service.createAppointment(params)).rejects.toThrow(AppointmentConflictError);
    });
  });

  // -------------------------------------------------------------------------
  // getAppointmentById
  // -------------------------------------------------------------------------

  describe('getAppointmentById', () => {
    it('should return appointment for correct tenant', async () => {
      mockRepository.findById.mockResolvedValue(makeAppt());
      const appt = await service.getAppointmentById(APPT_ID, TENANT_ID);
      expect(appt.id).toBe(APPT_ID);
    });

    it('should throw AppointmentIsolationViolationError on tenant mismatch', async () => {
      mockRepository.findById.mockResolvedValue(makeAppt({ tenantId: 'other-tenant' }));
      await expect(service.getAppointmentById(APPT_ID, TENANT_ID)).rejects.toThrow(
        AppointmentIsolationViolationError,
      );
    });

    it('should throw AppointmentNotFoundError when record is missing', async () => {
      mockRepository.findById.mockResolvedValue(null);
      await expect(service.getAppointmentById(APPT_ID, TENANT_ID)).rejects.toThrow(
        AppointmentNotFoundError,
      );
    });
  });

  // -------------------------------------------------------------------------
  // Status Transitions
  // -------------------------------------------------------------------------

  describe('confirmAppointment', () => {
    it('should transition scheduled → confirmed', async () => {
      mockRepository.findById.mockResolvedValue(makeAppt({ status: 'scheduled' }));
      mockRepository.update.mockResolvedValue(makeAppt({ status: 'confirmed' }));

      const result = await service.confirmAppointment(APPT_ID, TENANT_ID, 'actor', 'req');
      expect(result.status).toBe('confirmed');
      expect(mockPublisher.publish).toHaveBeenCalledWith(
        expect.objectContaining({ type: EVENT_APPOINTMENT_CONFIRMED }),
      );
    });

    it('should reject transition from cancelled (terminal)', async () => {
      mockRepository.findById.mockResolvedValue(makeAppt({ status: 'cancelled' }));
      await expect(
        service.confirmAppointment(APPT_ID, TENANT_ID, 'actor', 'req'),
      ).rejects.toThrow(AppointmentAlreadyTerminalError);
    });
  });

  describe('checkInAppointment', () => {
    it('should transition confirmed → checked_in', async () => {
      mockRepository.findById.mockResolvedValue(makeAppt({ status: 'confirmed' }));
      mockRepository.update.mockResolvedValue(makeAppt({ status: 'checked_in' }));

      const result = await service.checkInAppointment(APPT_ID, TENANT_ID, 'actor', 'req');
      expect(result.status).toBe('checked_in');
      expect(mockPublisher.publish).toHaveBeenCalledWith(
        expect.objectContaining({ type: EVENT_APPOINTMENT_CHECKED_IN }),
      );
    });

    it('should reject transition from cancelled (terminal)', async () => {
      mockRepository.findById.mockResolvedValue(makeAppt({ status: 'cancelled' }));
      await expect(
        service.checkInAppointment(APPT_ID, TENANT_ID, 'actor', 'req'),
      ).rejects.toThrow(AppointmentAlreadyTerminalError);
    });
  });

  describe('startAppointment', () => {
    it('should transition checked_in → in_progress', async () => {
      mockRepository.findById.mockResolvedValue(makeAppt({ status: 'checked_in' }));
      mockRepository.update.mockResolvedValue(makeAppt({ status: 'in_progress' }));

      const result = await service.startAppointment(APPT_ID, TENANT_ID, 'actor', 'req');
      expect(result.status).toBe('in_progress');
      expect(mockPublisher.publish).toHaveBeenCalledWith(
        expect.objectContaining({ type: EVENT_APPOINTMENT_IN_PROGRESS }),
      );
    });

    it('should reject transition from cancelled (terminal)', async () => {
      mockRepository.findById.mockResolvedValue(makeAppt({ status: 'cancelled' }));
      await expect(
        service.startAppointment(APPT_ID, TENANT_ID, 'actor', 'req'),
      ).rejects.toThrow(AppointmentAlreadyTerminalError);
    });
  });

  describe('cancelAppointment', () => {
    it('should cancel active appointment and record reason', async () => {
      mockRepository.findById.mockResolvedValue(makeAppt({ status: 'scheduled' }));
      mockRepository.update.mockResolvedValue(
        makeAppt({ status: 'cancelled', cancellationReason: 'Patient request' }),
      );

      const result = await service.cancelAppointment({
        id: APPT_ID,
        tenantId: TENANT_ID,
        cancellationReason: 'Patient request',
        actorId: 'actor',
        requestId: 'req',
      });

      expect(result.status).toBe('cancelled');
      expect(mockPublisher.publish).toHaveBeenCalledWith(
        expect.objectContaining({ type: EVENT_APPOINTMENT_CANCELLED }),
      );
    });

    it('should reject cancelling an already completed appointment', async () => {
      mockRepository.findById.mockResolvedValue(makeAppt({ status: 'completed' }));
      await expect(
        service.cancelAppointment({ id: APPT_ID, tenantId: TENANT_ID, actorId: 'a', requestId: 'r' }),
      ).rejects.toThrow(AppointmentAlreadyTerminalError);
    });
  });

  describe('rescheduleAppointment', () => {
    it('should reschedule scheduled appointment to new valid slot', async () => {
      setupHappyPath();
      mockRepository.findById.mockResolvedValue(makeAppt({ status: 'scheduled' }));
      mockRepository.update.mockResolvedValue(
        makeAppt({
          status: 'rescheduled',
          startTime: new Date('2025-01-03T10:00:00Z'),
          endTime:   new Date('2025-01-03T10:30:00Z'),
        }),
      );

      const result = await service.rescheduleAppointment({
        id: APPT_ID,
        tenantId: TENANT_ID,
        startTime: new Date('2025-01-03T10:00:00Z'), // Friday (day 5)
        endTime:   new Date('2025-01-03T10:30:00Z'),
        actorId: 'actor',
        requestId: 'req',
      });

      expect(result.status).toBe('rescheduled');
      expect(mockPublisher.publish).toHaveBeenCalledWith(
        expect.objectContaining({ type: EVENT_APPOINTMENT_RESCHEDULED }),
      );
    });

    it('should reject rescheduling a terminal appointment', async () => {
      mockRepository.findById.mockResolvedValue(makeAppt({ status: 'completed' }));

      await expect(
        service.rescheduleAppointment({
          id: APPT_ID, tenantId: TENANT_ID,
          startTime: new Date('2025-01-03T09:00:00Z'),
          endTime:   new Date('2025-01-03T09:30:00Z'),
          actorId: 'actor', requestId: 'req',
        }),
      ).rejects.toThrow(AppointmentAlreadyTerminalError);
    });
  });

  describe('completeAppointment', () => {
    it('should transition confirmed → completed', async () => {
      mockRepository.findById.mockResolvedValue(makeAppt({ status: 'confirmed' }));
      mockRepository.update.mockResolvedValue(makeAppt({ status: 'completed' }));

      const result = await service.completeAppointment(APPT_ID, TENANT_ID, 'actor', 'req');
      expect(result.status).toBe('completed');
      expect(mockPublisher.publish).toHaveBeenCalledWith(
        expect.objectContaining({ type: EVENT_APPOINTMENT_COMPLETED }),
      );
    });

    it('should reject completing a pending appointment (invalid transition)', async () => {
      mockRepository.findById.mockResolvedValue(makeAppt({ status: 'pending' }));
      await expect(
        service.completeAppointment(APPT_ID, TENANT_ID, 'actor', 'req'),
      ).rejects.toThrow(InvalidAppointmentStatusTransitionError);
    });
  });

  describe('markNoShow', () => {
    it('should transition confirmed → no_show', async () => {
      mockRepository.findById.mockResolvedValue(makeAppt({ status: 'confirmed' }));
      mockRepository.update.mockResolvedValue(makeAppt({ status: 'no_show' }));

      const result = await service.markNoShow(APPT_ID, TENANT_ID, 'actor', 'req');
      expect(result.status).toBe('no_show');
      expect(mockPublisher.publish).toHaveBeenCalledWith(
        expect.objectContaining({ type: EVENT_APPOINTMENT_NO_SHOW }),
      );
    });
  });

  // -------------------------------------------------------------------------
  // updateAppointment
  // -------------------------------------------------------------------------

  describe('updateAppointment', () => {
    it('should update notes and publish updated event', async () => {
      mockRepository.findById.mockResolvedValue(makeAppt({ status: 'pending' }));
      mockRepository.update.mockResolvedValue(makeAppt({ notes: 'Updated notes' }));

      const result = await service.updateAppointment({
        id: APPT_ID, tenantId: TENANT_ID, notes: 'Updated notes',
        actorId: 'actor', requestId: 'req',
      });

      expect(mockPublisher.publish).toHaveBeenCalledWith(
        expect.objectContaining({ type: EVENT_APPOINTMENT_UPDATED }),
      );
      expect(result).toBeDefined();
    });

    it('should throw for terminal status', async () => {
      mockRepository.findById.mockResolvedValue(makeAppt({ status: 'cancelled' }));
      await expect(
        service.updateAppointment({ id: APPT_ID, tenantId: TENANT_ID, actorId: 'a', requestId: 'r' }),
      ).rejects.toThrow(AppointmentAlreadyTerminalError);
    });
  });

  // -------------------------------------------------------------------------
  // listAppointments
  // -------------------------------------------------------------------------

  describe('listAppointments', () => {
    it('should return mapped list of appointments', async () => {
      mockRepository.findMany.mockResolvedValue([makeAppt(), makeAppt({ id: 'other-id', publicId: 'appt_xyz' })]);
      mockRepository.countMany.mockResolvedValue(2);
      const results = await service.listAppointments({ tenantId: TENANT_ID });
      expect(results.appointments).toHaveLength(2);
      expect(results.total).toBe(2);
    });

    it('should return empty array when no appointments found', async () => {
      mockRepository.findMany.mockResolvedValue([]);
      mockRepository.countMany.mockResolvedValue(0);
      const results = await service.listAppointments({ tenantId: TENANT_ID });
      expect(results.appointments).toHaveLength(0);
      expect(results.total).toBe(0);
    });
  });
});

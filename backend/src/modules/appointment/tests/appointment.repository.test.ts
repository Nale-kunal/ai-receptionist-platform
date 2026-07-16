/**
 * Appointment Repository Unit Tests
 *
 * Verifies the IAppointmentRepository contract is correctly implemented.
 */

import { AppointmentRepository } from '../repositories/appointment.repository';

// ---------------------------------------------------------------------------
// Prisma Mock
// ---------------------------------------------------------------------------

const mockAppointmentDelegate = {
  create:   jest.fn(),
  update:   jest.fn(),
  findFirst:jest.fn(),
  findMany: jest.fn(),
};

const mockDoctorDelegate  = { count: jest.fn(), findFirst: jest.fn() };
const mockPatientDelegate = { count: jest.fn(), findFirst: jest.fn() };
const mockClinicDelegate  = { count: jest.fn() };

const mockPrisma = {
  appointment: mockAppointmentDelegate,
  doctor:      mockDoctorDelegate,
  patient:     mockPatientDelegate,
  clinic:      mockClinicDelegate,
};

// ---------------------------------------------------------------------------
// Test Data
// ---------------------------------------------------------------------------

const TENANT_ID  = '550e8400-e29b-41d4-a716-446655440000';
const CLINIC_ID  = '550e8400-e29b-41d4-a716-446655440001';
const DOCTOR_ID  = '550e8400-e29b-41d4-a716-446655440002';
const PATIENT_ID = '550e8400-e29b-41d4-a716-446655440003';
const APPT_ID    = '550e8400-e29b-41d4-a716-446655440004';

const START = new Date('2025-01-01T09:00:00Z');
const END   = new Date('2025-01-01T09:30:00Z');

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AppointmentRepository', () => {
  let repo: AppointmentRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new AppointmentRepository(mockPrisma as any);
  });

  describe('create', () => {
    it('should call prisma.appointment.create with correct data', async () => {
      const appt = { id: APPT_ID };
      mockAppointmentDelegate.create.mockResolvedValue(appt);

      const result = await repo.create({
        tenantId: TENANT_ID, clinicId: CLINIC_ID, doctorId: DOCTOR_ID,
        patientId: PATIENT_ID, startTime: START, endTime: END,
        timezone: 'UTC', status: 'pending', source: 'dashboard',
      });

      expect(mockAppointmentDelegate.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'pending' }),
        }),
      );
      expect(result).toBe(appt);
    });
  });

  describe('findById', () => {
    it('should filter out soft-deleted by default', async () => {
      mockAppointmentDelegate.findFirst.mockResolvedValue(null);
      await repo.findById(APPT_ID);
      expect(mockAppointmentDelegate.findFirst).toHaveBeenCalledWith({
        where: { id: APPT_ID, deletedAt: null },
      });
    });

    it('should include deleted when includeDeleted=true', async () => {
      mockAppointmentDelegate.findFirst.mockResolvedValue(null);
      await repo.findById(APPT_ID, true);
      expect(mockAppointmentDelegate.findFirst).toHaveBeenCalledWith({
        where: { id: APPT_ID },
      });
    });
  });

  describe('findConflicts', () => {
    it('should query with overlap conditions and only active statuses', async () => {
      mockAppointmentDelegate.findMany.mockResolvedValue([]);
      const result = await repo.findConflicts({
        doctorId: DOCTOR_ID, clinicId: CLINIC_ID, startTime: START, endTime: END,
      });
      expect(result).toEqual([]);
      expect(mockAppointmentDelegate.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            doctorId: DOCTOR_ID,
            clinicId: CLINIC_ID,
            startTime: { lt: END },
            endTime:   { gt: START },
          }),
        }),
      );
    });

    it('should exclude the given appointment ID when excludeId is provided', async () => {
      mockAppointmentDelegate.findMany.mockResolvedValue([]);
      await repo.findConflicts({
        doctorId: DOCTOR_ID, clinicId: CLINIC_ID,
        startTime: START, endTime: END, excludeId: APPT_ID,
      });
      expect(mockAppointmentDelegate.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: { not: APPT_ID },
          }),
        }),
      );
    });
  });

  describe('doctorBelongsToClinic', () => {
    it('should return true when count > 0', async () => {
      mockDoctorDelegate.count.mockResolvedValue(1);
      const result = await repo.doctorBelongsToClinic(DOCTOR_ID, CLINIC_ID, TENANT_ID);
      expect(result).toBe(true);
    });

    it('should return false when count = 0', async () => {
      mockDoctorDelegate.count.mockResolvedValue(0);
      const result = await repo.doctorBelongsToClinic(DOCTOR_ID, CLINIC_ID, TENANT_ID);
      expect(result).toBe(false);
    });
  });

  describe('patientBelongsToClinic', () => {
    it('should return true when count > 0', async () => {
      mockPatientDelegate.count.mockResolvedValue(1);
      const result = await repo.patientBelongsToClinic(PATIENT_ID, CLINIC_ID, TENANT_ID);
      expect(result).toBe(true);
    });
  });

  describe('clinicIsActive', () => {
    it('should return true for an active clinic', async () => {
      mockClinicDelegate.count.mockResolvedValue(1);
      const result = await repo.clinicIsActive(CLINIC_ID, TENANT_ID);
      expect(result).toBe(true);
      expect(mockClinicDelegate.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: { notIn: ['suspended', 'deleted'] },
          }),
        }),
      );
    });

    it('should return false for a suspended clinic', async () => {
      mockClinicDelegate.count.mockResolvedValue(0);
      const result = await repo.clinicIsActive(CLINIC_ID, TENANT_ID);
      expect(result).toBe(false);
    });
  });

  describe('getDoctorStatus', () => {
    it('should return doctor status string', async () => {
      mockDoctorDelegate.findFirst.mockResolvedValue({ status: 'active' });
      const result = await repo.getDoctorStatus(DOCTOR_ID);
      expect(result).toBe('active');
    });

    it('should return null when doctor not found', async () => {
      mockDoctorDelegate.findFirst.mockResolvedValue(null);
      const result = await repo.getDoctorStatus(DOCTOR_ID);
      expect(result).toBeNull();
    });
  });

  describe('getPatientStatus', () => {
    it('should return patient status string', async () => {
      mockPatientDelegate.findFirst.mockResolvedValue({ status: 'active' });
      const result = await repo.getPatientStatus(PATIENT_ID);
      expect(result).toBe('active');
    });
  });
});

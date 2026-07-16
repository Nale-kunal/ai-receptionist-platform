/**
 * Doctor Service Unit Tests
 */

import { DoctorService } from '../services/doctor.service';
import {
  DoctorNotFoundError,
  DoctorIsolationViolationError,
  DoctorArchivedError,
  DuplicateLicenseNumberError,
  InvalidDoctorStatusTransitionError,
  ClinicTenantMismatchError,
} from '../errors/doctor.errors';
import {
  EVENT_DOCTOR_CREATED,
  EVENT_DOCTOR_UPDATED,
  EVENT_DOCTOR_WORKING_HOURS_UPDATED,
  EVENT_DOCTOR_AVAILABILITY_UPDATED,
} from '../events/doctor.events';

const mockRepository = {
  create: jest.fn(),
  update: jest.fn(),
  findById: jest.fn(),
  findByPublicId: jest.fn(),
  findByLicenseNumber: jest.fn(),
  findMany: jest.fn(),
  clinicBelongsToTenant: jest.fn(),
};

const mockPublisher = {
  publish: jest.fn(),
};

const TENANT_ID = '550e8400-e29b-41d4-a716-446655440000';
const OTHER_TENANT = '550e8400-e29b-41d4-a716-446655440009';
const CLINIC_ID = '550e8400-e29b-41d4-a716-446655440002';
const OTHER_CLINIC = '550e8400-e29b-41d4-a716-446655440099';
const DOCTOR_ID = '550e8400-e29b-41d4-a716-446655440001';

function makeSafeDoctor(overrides: Record<string, unknown> = {}) {
  return {
    id: DOCTOR_ID,
    publicId: 'dctr_abc123',
    tenantId: TENANT_ID,
    clinicId: CLINIC_ID,
    fullName: 'Dr. John Doe',
    displayName: 'Dr. Doe',
    specialization: 'General Dentistry',
    licenseNumber: 'LIC-12345',
    biography: null,
    email: null,
    phone: null,
    status: 'active',
    profilePhoto: null,
    workingHours: [],
    leaves: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...overrides,
  };
}

describe('DoctorService', () => {
  let service: DoctorService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new DoctorService(mockRepository as any, mockPublisher as any);
  });

  describe('createDoctor', () => {
    it('should create successfully when clinic belongs to tenant, license unique', async () => {
      const params = {
        tenantId: TENANT_ID,
        clinicId: CLINIC_ID,
        fullName: 'Dr. John Doe',
        displayName: 'Dr. Doe',
        specialization: 'General Dentistry',
        licenseNumber: 'LIC-12345',
        actorId: 'user-admin',
        requestId: 'req-1',
      };

      mockRepository.clinicBelongsToTenant.mockResolvedValue(true);
      mockRepository.findByLicenseNumber.mockResolvedValue(null);
      mockRepository.create.mockImplementation((data: any) =>
        Promise.resolve(makeSafeDoctor({ ...data, id: DOCTOR_ID })),
      );

      const result = await service.createDoctor(params);

      expect(mockRepository.clinicBelongsToTenant).toHaveBeenCalledWith(CLINIC_ID, TENANT_ID);
      expect(mockRepository.findByLicenseNumber).toHaveBeenCalledWith('LIC-12345', TENANT_ID);
      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'active',
        }),
      );
      expect(mockPublisher.publish).toHaveBeenCalledWith(
        expect.objectContaining({ type: EVENT_DOCTOR_CREATED }),
      );
      expect(result.id).toBe(DOCTOR_ID);
    });

    it('should throw ClinicTenantMismatchError if clinic does not belong to tenant', async () => {
      const params = {
        tenantId: TENANT_ID,
        clinicId: CLINIC_ID,
        fullName: 'Dr. John Doe',
        displayName: 'Dr. Doe',
        specialization: 'General Dentistry',
        actorId: 'user-admin',
        requestId: 'req-1',
      };

      mockRepository.clinicBelongsToTenant.mockResolvedValue(false);

      await expect(service.createDoctor(params)).rejects.toThrow(ClinicTenantMismatchError);
    });

    it('should throw DuplicateLicenseNumberError if license number is already in use', async () => {
      const params = {
        tenantId: TENANT_ID,
        clinicId: CLINIC_ID,
        fullName: 'Dr. John Doe',
        displayName: 'Dr. Doe',
        specialization: 'General Dentistry',
        licenseNumber: 'LIC-12345',
        actorId: 'user-admin',
        requestId: 'req-1',
      };

      mockRepository.clinicBelongsToTenant.mockResolvedValue(true);
      mockRepository.findByLicenseNumber.mockResolvedValue({ id: 'other-doctor-id' });

      await expect(service.createDoctor(params)).rejects.toThrow(DuplicateLicenseNumberError);
    });
  });

  describe('updateDoctor', () => {
    it('should update properties successfully', async () => {
      const existing = makeSafeDoctor({ status: 'active' });
      mockRepository.findById.mockResolvedValue(existing);
      mockRepository.update.mockImplementation((id: string, data: any) =>
        Promise.resolve(makeSafeDoctor({ ...existing, ...data })),
      );

      const params = {
        id: DOCTOR_ID,
        tenantId: TENANT_ID,
        fullName: 'Dr. John Updated',
        actorId: 'user-admin',
        requestId: 'req-2',
      };

      const result = await service.updateDoctor(params);

      expect(mockRepository.update).toHaveBeenCalledWith(DOCTOR_ID, {
        fullName: 'Dr. John Updated',
      });
      expect(mockPublisher.publish).toHaveBeenCalledWith(
        expect.objectContaining({ type: EVENT_DOCTOR_UPDATED }),
      );
      expect(result.fullName).toBe('Dr. John Updated');
    });

    it('should validate clinic-tenant match if clinic changes during update', async () => {
      const existing = makeSafeDoctor({ status: 'active' });
      mockRepository.findById.mockResolvedValue(existing);
      mockRepository.clinicBelongsToTenant.mockResolvedValue(false);

      const params = {
        id: DOCTOR_ID,
        tenantId: TENANT_ID,
        clinicId: OTHER_CLINIC,
        actorId: 'user-admin',
        requestId: 'req-2',
      };

      await expect(service.updateDoctor(params)).rejects.toThrow(ClinicTenantMismatchError);
    });
  });

  describe('workingHours & leaves updates', () => {
    it('should update working hours and dispatch event', async () => {
      const existing = makeSafeDoctor({ status: 'active' });
      mockRepository.findById.mockResolvedValue(existing);
      const workingHours = [{ dayOfWeek: 1, openTime: '08:00', closeTime: '16:00', isClosed: false }];
      mockRepository.update.mockResolvedValue(makeSafeDoctor({ workingHours }));

      const result = await service.updateWorkingHours(DOCTOR_ID, TENANT_ID, workingHours, 'actor-1', 'req-3');

      expect(result.workingHours).toEqual(workingHours);
      expect(mockPublisher.publish).toHaveBeenCalledWith(
        expect.objectContaining({ type: EVENT_DOCTOR_WORKING_HOURS_UPDATED }),
      );
    });

    it('should update leaves and dispatch event', async () => {
      const existing = makeSafeDoctor({ status: 'active' });
      mockRepository.findById.mockResolvedValue(existing);
      const leaves = [{ startDate: '2026-12-01', endDate: '2026-12-05', reason: 'Vacation' }];
      mockRepository.update.mockResolvedValue(makeSafeDoctor({ leaves }));

      const result = await service.updateLeaves(DOCTOR_ID, TENANT_ID, leaves, 'actor-1', 'req-3');

      expect(result.leaves).toEqual(leaves);
      expect(mockPublisher.publish).toHaveBeenCalledWith(
        expect.objectContaining({ type: EVENT_DOCTOR_AVAILABILITY_UPDATED }),
      );
    });
  });

  describe('lifecycle transitions', () => {
    it('should allow active -> inactive', async () => {
      const existing = makeSafeDoctor({ status: 'active' });
      mockRepository.findById.mockResolvedValue(existing);
      mockRepository.update.mockResolvedValue(makeSafeDoctor({ status: 'inactive' }));

      const result = await service.transitionStatus(DOCTOR_ID, TENANT_ID, 'inactive', 'actor-1', 'req-3');
      expect(result.status).toBe('inactive');
    });

    it('should reject invalid transition archived -> inactive', async () => {
      const existing = makeSafeDoctor({ status: 'archived' });
      mockRepository.findById.mockResolvedValue(existing);

      await expect(
        service.transitionStatus(DOCTOR_ID, TENANT_ID, 'inactive', 'actor-1', 'req-3'),
      ).rejects.toThrow(InvalidDoctorStatusTransitionError);
    });
  });
});

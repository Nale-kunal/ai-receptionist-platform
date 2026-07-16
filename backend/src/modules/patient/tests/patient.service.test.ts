/**
 * Patient Service Unit Tests
 */

import { PatientService } from '../services/patient.service';
import {
  PatientNotFoundError,
  PatientIsolationViolationError,
  PatientArchivedError,
  DuplicatePatientError,
  InvalidPatientStatusTransitionError,
  ClinicTenantMismatchError,
} from '../errors/patient.errors';
import {
  EVENT_PATIENT_CREATED,
  EVENT_PATIENT_UPDATED,
} from '../events/patient.events';

const mockRepository = {
  create: jest.fn(),
  update: jest.fn(),
  findById: jest.fn(),
  findByPublicId: jest.fn(),
  findByPhone: jest.fn(),
  findByEmail: jest.fn(),
  findMany: jest.fn(),
  clinicBelongsToTenant: jest.fn(),
};

const mockPublisher = {
  publish: jest.fn(),
};

const TENANT_ID = '550e8400-e29b-41d4-a716-446655440000';
const CLINIC_ID = '550e8400-e29b-41d4-a716-446655440002';
const OTHER_CLINIC = '550e8400-e29b-41d4-a716-446655440099';
const PATIENT_ID = '550e8400-e29b-41d4-a716-446655440001';

function makeSafePatient(overrides: Record<string, unknown> = {}) {
  return {
    id: PATIENT_ID,
    publicId: 'pat_abc123',
    tenantId: TENANT_ID,
    clinicId: CLINIC_ID,
    fullName: 'Jane Smith',
    phone: '+15555554321',
    email: 'janesmith@example.com',
    dateOfBirth: null,
    gender: null,
    preferredLanguage: 'en',
    preferredContactMethod: 'sms',
    status: 'active',
    emergencyContact: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...overrides,
  };
}

describe('PatientService', () => {
  let service: PatientService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new PatientService(mockRepository as any, mockPublisher as any);
  });

  describe('createPatient', () => {
    it('should create successfully when clinic belongs to tenant and phone unique', async () => {
      const params = {
        tenantId: TENANT_ID,
        clinicId: CLINIC_ID,
        fullName: 'Jane Smith',
        phone: '+15555554321',
        email: 'janesmith@example.com',
        actorId: 'user-admin',
        requestId: 'req-1',
      };

      mockRepository.clinicBelongsToTenant.mockResolvedValue(true);
      mockRepository.findByPhone.mockResolvedValue(null);
      mockRepository.findByEmail.mockResolvedValue(null);
      mockRepository.create.mockImplementation((data: any) =>
        Promise.resolve(makeSafePatient({ ...data, id: PATIENT_ID })),
      );

      const result = await service.createPatient(params);

      expect(mockRepository.clinicBelongsToTenant).toHaveBeenCalledWith(CLINIC_ID, TENANT_ID);
      expect(mockRepository.findByPhone).toHaveBeenCalledWith('+15555554321', CLINIC_ID);
      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'active',
        }),
      );
      expect(mockPublisher.publish).toHaveBeenCalledWith(
        expect.objectContaining({ type: EVENT_PATIENT_CREATED }),
      );
      expect(result.id).toBe(PATIENT_ID);
    });

    it('should throw ClinicTenantMismatchError if clinic does not belong to tenant', async () => {
      const params = {
        tenantId: TENANT_ID,
        clinicId: CLINIC_ID,
        fullName: 'Jane Smith',
        phone: '+15555554321',
        actorId: 'user-admin',
        requestId: 'req-1',
      };

      mockRepository.clinicBelongsToTenant.mockResolvedValue(false);

      await expect(service.createPatient(params)).rejects.toThrow(ClinicTenantMismatchError);
    });

    it('should throw DuplicatePatientError if phone already exists in clinic', async () => {
      const params = {
        tenantId: TENANT_ID,
        clinicId: CLINIC_ID,
        fullName: 'Jane Smith',
        phone: '+15555554321',
        actorId: 'user-admin',
        requestId: 'req-1',
      };

      mockRepository.clinicBelongsToTenant.mockResolvedValue(true);
      mockRepository.findByPhone.mockResolvedValue({ id: 'other-patient-id' });

      await expect(service.createPatient(params)).rejects.toThrow(DuplicatePatientError);
    });
  });

  describe('updatePatient', () => {
    it('should update properties successfully', async () => {
      const existing = makeSafePatient({ status: 'active' });
      mockRepository.findById.mockResolvedValue(existing);
      mockRepository.update.mockImplementation((id: string, data: any) =>
        Promise.resolve(makeSafePatient({ ...existing, ...data })),
      );

      const params = {
        id: PATIENT_ID,
        tenantId: TENANT_ID,
        fullName: 'Jane Smith Updated',
        actorId: 'user-admin',
        requestId: 'req-2',
      };

      const result = await service.updatePatient(params);

      expect(mockRepository.update).toHaveBeenCalledWith(PATIENT_ID, {
        fullName: 'Jane Smith Updated',
      });
      expect(mockPublisher.publish).toHaveBeenCalledWith(
        expect.objectContaining({ type: EVENT_PATIENT_UPDATED }),
      );
      expect(result.fullName).toBe('Jane Smith Updated');
    });

    it('should lock archived records from being updated', async () => {
      const existing = makeSafePatient({ status: 'archived' });
      mockRepository.findById.mockResolvedValue(existing);

      const params = {
        id: PATIENT_ID,
        tenantId: TENANT_ID,
        fullName: 'Jane Smith Updated',
        actorId: 'user-admin',
        requestId: 'req-2',
      };

      await expect(service.updatePatient(params)).rejects.toThrow(PatientArchivedError);
    });
  });

  describe('lifecycle transitions', () => {
    it('should allow active -> inactive', async () => {
      const existing = makeSafePatient({ status: 'active' });
      mockRepository.findById.mockResolvedValue(existing);
      mockRepository.update.mockResolvedValue(makeSafePatient({ status: 'inactive' }));

      const result = await service.transitionStatus(PATIENT_ID, TENANT_ID, 'inactive', 'actor-1', 'req-3');
      expect(result.status).toBe('inactive');
    });

    it('should reject invalid transition archived -> inactive', async () => {
      const existing = makeSafePatient({ status: 'archived' });
      mockRepository.findById.mockResolvedValue(existing);

      await expect(
        service.transitionStatus(PATIENT_ID, TENANT_ID, 'inactive', 'actor-1', 'req-3'),
      ).rejects.toThrow(InvalidPatientStatusTransitionError);
    });
  });
});

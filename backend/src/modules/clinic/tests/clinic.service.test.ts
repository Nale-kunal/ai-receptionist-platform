/**
 * Clinic Service Unit Tests
 */

import { ClinicService } from '../services/clinic.service';
import {
  ClinicNotFoundError,
  ClinicIsolationViolationError,
  ClinicArchivedError,
  DuplicateClinicSlugError,
  InvalidClinicStatusTransitionError,
  OwnerTenantMismatchError,
} from '../errors/clinic.errors';
import {
  EVENT_CLINIC_CREATED,
  EVENT_CLINIC_UPDATED,
  EVENT_CLINIC_OWNERSHIP_TRANSFERRED,
} from '../events/clinic.events';

const mockRepository = {
  create: jest.fn(),
  update: jest.fn(),
  findById: jest.fn(),
  findBySlug: jest.fn(),
  findMany: jest.fn(),
  exists: jest.fn(),
  userBelongsToTenant: jest.fn(),
};

const mockPublisher = {
  publish: jest.fn(),
};

const TENANT_ID = '550e8400-e29b-41d4-a716-446655440000';
const OTHER_TENANT = '550e8400-e29b-41d4-a716-446655440009';
const OWNER_ID = '550e8400-e29b-41d4-a716-446655440002';
const CLINIC_ID = '550e8400-e29b-41d4-a716-446655440001';

function makeSafeClinic(overrides: Record<string, unknown> = {}) {
  return {
    id: CLINIC_ID,
    publicId: 'clnc_abc123',
    tenantId: TENANT_ID,
    ownerId: OWNER_ID,
    name: 'Smile Care',
    legalName: null,
    slug: 'smile-care',
    timezone: 'UTC',
    country: 'US',
    status: 'pending_setup',
    primaryEmail: null,
    primaryPhone: null,
    website: null,
    address: null,
    city: null,
    state: null,
    postalCode: null,
    logoReference: null,
    brandIdentifier: null,
    subscriptionId: null,
    planId: null,
    subscriptionStatus: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...overrides,
  };
}

describe('ClinicService', () => {
  let service: ClinicService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ClinicService(mockRepository as any, mockPublisher as any);
  });

  describe('createClinic', () => {
    it('should create successfully when owner is valid, slug is unique, and timezone is valid', async () => {
      const params = {
        tenantId: TENANT_ID,
        ownerId: OWNER_ID,
        name: 'Smile Care',
        slug: 'smile-care',
        timezone: 'America/New_York',
        country: 'US',
        actorId: 'user-admin',
        requestId: 'req-1',
      };

      mockRepository.userBelongsToTenant.mockResolvedValue(true);
      mockRepository.exists.mockResolvedValue(false);
      mockRepository.create.mockImplementation((data: any) =>
        Promise.resolve(makeSafeClinic({ ...data, id: CLINIC_ID })),
      );

      const result = await service.createClinic(params);

      expect(mockRepository.userBelongsToTenant).toHaveBeenCalledWith(OWNER_ID, TENANT_ID);
      expect(mockRepository.exists).toHaveBeenCalledWith('smile-care');
      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'pending_setup',
        }),
      );
      expect(mockPublisher.publish).toHaveBeenCalledWith(
        expect.objectContaining({ type: EVENT_CLINIC_CREATED }),
      );
      expect(result.id).toBe(CLINIC_ID);
    });

    it('should throw OwnerTenantMismatchError if owner does not belong to same tenant', async () => {
      const params = {
        tenantId: TENANT_ID,
        ownerId: OWNER_ID,
        name: 'Smile Care',
        slug: 'smile-care',
        timezone: 'America/New_York',
        country: 'US',
        actorId: 'user-admin',
        requestId: 'req-1',
      };

      mockRepository.userBelongsToTenant.mockResolvedValue(false);

      await expect(service.createClinic(params)).rejects.toThrow(OwnerTenantMismatchError);
    });

    it('should throw DuplicateClinicSlugError if slug is already taken', async () => {
      const params = {
        tenantId: TENANT_ID,
        ownerId: OWNER_ID,
        name: 'Smile Care',
        slug: 'smile-care',
        timezone: 'America/New_York',
        country: 'US',
        actorId: 'user-admin',
        requestId: 'req-1',
      };

      mockRepository.userBelongsToTenant.mockResolvedValue(true);
      mockRepository.exists.mockResolvedValue(true);

      await expect(service.createClinic(params)).rejects.toThrow(DuplicateClinicSlugError);
    });
  });

  describe('updateClinic', () => {
    it('should update properties and dispatch updated event', async () => {
      const existing = makeSafeClinic({ status: 'active' });
      mockRepository.findById.mockResolvedValue(existing);
      mockRepository.update.mockImplementation((id: string, data: any) =>
        Promise.resolve(makeSafeClinic({ ...existing, ...data })),
      );

      const params = {
        id: CLINIC_ID,
        tenantId: TENANT_ID,
        name: 'Smile Care New Name',
        actorId: 'user-admin',
        requestId: 'req-2',
      };

      const result = await service.updateClinic(params);

      expect(mockRepository.update).toHaveBeenCalledWith(CLINIC_ID, {
        name: 'Smile Care New Name',
      });
      expect(mockPublisher.publish).toHaveBeenCalledWith(
        expect.objectContaining({ type: EVENT_CLINIC_UPDATED }),
      );
      expect(result.name).toBe('Smile Care New Name');
    });

    it('should throw ClinicArchivedError if clinic is archived', async () => {
      mockRepository.findById.mockResolvedValue(makeSafeClinic({ status: 'archived' }));

      const params = {
        id: CLINIC_ID,
        tenantId: TENANT_ID,
        name: 'New Name',
        actorId: 'user-admin',
        requestId: 'req-2',
      };

      await expect(service.updateClinic(params)).rejects.toThrow(ClinicArchivedError);
    });

    it('should throw ClinicIsolationViolationError if tenant does not match', async () => {
      mockRepository.findById.mockResolvedValue(makeSafeClinic({ tenantId: OTHER_TENANT }));

      const params = {
        id: CLINIC_ID,
        tenantId: TENANT_ID,
        name: 'New Name',
        actorId: 'user-admin',
        requestId: 'req-2',
      };

      await expect(service.updateClinic(params)).rejects.toThrow(ClinicIsolationViolationError);
    });
  });

  describe('lifecycle transitions', () => {
    it('should allow valid transition pending_setup -> active', async () => {
      const existing = makeSafeClinic({ status: 'pending_setup' });
      mockRepository.findById.mockResolvedValue(existing);
      mockRepository.update.mockResolvedValue(makeSafeClinic({ status: 'active' }));

      const result = await service.transitionStatus(
        CLINIC_ID,
        TENANT_ID,
        'active',
        'actor-1',
        'req-3',
      );

      expect(result.status).toBe('active');
    });

    it('should reject invalid transition archived -> suspended', async () => {
      const existing = makeSafeClinic({ status: 'archived' });
      mockRepository.findById.mockResolvedValue(existing);

      await expect(
        service.transitionStatus(CLINIC_ID, TENANT_ID, 'suspended', 'actor-1', 'req-3'),
      ).rejects.toThrow(InvalidClinicStatusTransitionError);
    });
  });

  describe('transferOwnership', () => {
    it('should transfer owner when owner belongs to same tenant', async () => {
      const targetOwner = '550e8400-e29b-41d4-a716-446655440099';
      mockRepository.findById.mockResolvedValue(makeSafeClinic({ status: 'active' }));
      mockRepository.userBelongsToTenant.mockResolvedValue(true);
      mockRepository.update.mockResolvedValue(makeSafeClinic({ ownerId: targetOwner }));

      const result = await service.transferOwnership(
        CLINIC_ID,
        TENANT_ID,
        targetOwner,
        'admin-user',
        'req-4',
      );

      expect(result.ownerId).toBe(targetOwner);
      expect(mockPublisher.publish).toHaveBeenCalledWith(
        expect.objectContaining({ type: EVENT_CLINIC_OWNERSHIP_TRANSFERRED }),
      );
    });
  });
});

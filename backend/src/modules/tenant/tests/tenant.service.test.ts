/**
 * Tenant Service Unit Tests
 *
 * Verifies business logic, slug uniqueness, and allowed lifecycle transitions.
 */

import { TenantService } from '../services/tenant.service';
import {
  TenantNotFoundError,
  DuplicateTenantSlugError,
  InvalidTenantStatusTransitionError,
} from '../errors/tenant.errors';

const mockTenantRepository = {
  create: jest.fn(),
  update: jest.fn(),
  findById: jest.fn(),
  findBySlug: jest.fn(),
  findMany: jest.fn(),
  exists: jest.fn(),
};

const mockEventPublisher = {
  publish: jest.fn(),
};

function makeTenant(overrides: Record<string, unknown> = {}) {
  return {
    id: 'd9b2326b-f458-47e2-881c-cb8b4445d045',
    publicId: 'tnt_abc123',
    name: 'Smile Clinic',
    slug: 'smile-clinic',
    status: 'created',
    timezone: 'UTC',
    country: 'US',
    language: 'en',
    subscriptionPlan: 'free',
    branding: {},
    metadata: {},
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...overrides,
  };
}

describe('TenantService', () => {
  let service: TenantService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new TenantService(mockTenantRepository as any, mockEventPublisher);
  });

  describe('createTenant', () => {
    it('should throw DuplicateTenantSlugError if slug is taken', async () => {
      mockTenantRepository.exists.mockResolvedValue(true);

      await expect(
        service.createTenant({
          name: 'Smile Clinic',
          slug: 'smile-clinic',
          actorId: 'actor-1',
          requestId: 'req-1',
        }),
      ).rejects.toThrow(DuplicateTenantSlugError);
    });

    it('should create tenant in created status and publish event', async () => {
      mockTenantRepository.exists.mockResolvedValue(false);
      const dbTenant = makeTenant({ status: 'created' });
      mockTenantRepository.create.mockResolvedValue(dbTenant);

      const result = await service.createTenant({
        name: 'Smile Clinic',
        slug: 'smile-clinic',
        actorId: 'actor-1',
        requestId: 'req-1',
      });

      expect(result.status).toBe('created');
      expect(mockEventPublisher.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'tenant.created',
          name: 'Smile Clinic',
        }),
      );
    });
  });

  describe('updateTenant', () => {
    it('should throw TenantNotFoundError if tenant is missing', async () => {
      mockTenantRepository.findById.mockResolvedValue(null);

      await expect(
        service.updateTenant({
          id: 'missing-id',
          name: 'New Name',
          actorId: 'actor-1',
          requestId: 'req-1',
        }),
      ).rejects.toThrow(TenantNotFoundError);
    });

    it('should update properties and publish updated event', async () => {
      const existing = makeTenant();
      mockTenantRepository.findById.mockResolvedValue(existing);
      const updated = makeTenant({ name: 'Updated Smile Clinic' });
      mockTenantRepository.update.mockResolvedValue(updated);

      const result = await service.updateTenant({
        id: existing.id,
        name: 'Updated Smile Clinic',
        actorId: 'actor-1',
        requestId: 'req-1',
      });

      expect(result.name).toBe('Updated Smile Clinic');
      expect(mockEventPublisher.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'tenant.updated',
          name: 'Updated Smile Clinic',
        }),
      );
    });
  });

  describe('lifecycle transitions', () => {
    it('should allow valid transition from provisioned to active', async () => {
      const existing = makeTenant({ status: 'provisioned' });
      mockTenantRepository.findById.mockResolvedValue(existing);
      mockTenantRepository.update.mockResolvedValue(makeTenant({ status: 'active' }));

      const result = await service.activateTenant(existing.id, 'actor-1', 'req-1');
      expect(result.status).toBe('active');
    });

    it('should allow active -> suspended and publish event', async () => {
      const existing = makeTenant({ status: 'active' });
      mockTenantRepository.findById.mockResolvedValue(existing);
      mockTenantRepository.update.mockResolvedValue(makeTenant({ status: 'suspended' }));

      const result = await service.suspendTenant(existing.id, 'actor-1', 'req-1');
      expect(result.status).toBe('suspended');
      expect(mockEventPublisher.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'tenant.suspended',
          tenantId: existing.id,
        }),
      );
    });

    it('should reject invalid transition suspended -> archived', async () => {
      const existing = makeTenant({ status: 'suspended' });
      mockTenantRepository.findById.mockResolvedValue(existing);

      await expect(
        service.archiveTenant(existing.id, 'actor-1', 'req-1'),
      ).rejects.toThrow(InvalidTenantStatusTransitionError);
    });

    it('should allow active -> archived and publish event', async () => {
      const existing = makeTenant({ status: 'active' });
      mockTenantRepository.findById.mockResolvedValue(existing);
      mockTenantRepository.update.mockResolvedValue(makeTenant({ status: 'archived' }));

      const result = await service.archiveTenant(existing.id, 'actor-1', 'req-1');
      expect(result.status).toBe('archived');
      expect(mockEventPublisher.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'tenant.archived',
        }),
      );
    });
  });

  describe('soft deletion and restoration', () => {
    it('should update status to deleted, set deletedAt, and publish event', async () => {
      const existing = makeTenant({ status: 'active' });
      mockTenantRepository.findById.mockResolvedValue(existing);
      mockTenantRepository.update.mockResolvedValue(makeTenant({ status: 'deleted', deletedAt: new Date() }));

      const result = await service.softDeleteTenant(existing.id, 'actor-1', 'req-1');
      expect(result.status).toBe('deleted');
      expect(mockEventPublisher.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'tenant.deleted',
        }),
      );
    });

    it('should restore soft-deleted tenant back to active', async () => {
      const existing = makeTenant({ status: 'deleted', deletedAt: new Date() });
      mockTenantRepository.findById.mockResolvedValue(existing);
      mockTenantRepository.update.mockResolvedValue(makeTenant({ status: 'active', deletedAt: null }));

      const result = await service.restoreTenant(existing.id, 'actor-1', 'req-1');
      expect(result.status).toBe('active');
      expect(mockEventPublisher.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'tenant.restored',
        }),
      );
    });
  });

  describe('updateSubscriptionPlan', () => {
    it('should update plan and publish event', async () => {
      const existing = makeTenant({ subscriptionPlan: 'free' });
      mockTenantRepository.findById.mockResolvedValue(existing);
      mockTenantRepository.update.mockResolvedValue(makeTenant({ subscriptionPlan: 'premium' }));

      const result = await service.updateSubscriptionPlan(existing.id, 'premium', 'actor-1', 'req-1');
      expect(result.subscriptionPlan).toBe('premium');
      expect(mockEventPublisher.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'tenant.subscription-updated',
          oldPlan: 'free',
          newPlan: 'premium',
        }),
      );
    });
  });
});

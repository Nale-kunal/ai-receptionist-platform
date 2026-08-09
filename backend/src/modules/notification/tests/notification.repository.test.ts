/**
 * Notification Repository Unit Tests
 *
 * Verifies the INotificationRepository contract is correctly implemented.
 */

import { NotificationRepository } from '../repositories/notification.repository';

// ---------------------------------------------------------------------------
// Prisma Mock
// ---------------------------------------------------------------------------

const mockNotificationDelegate = {
  create: jest.fn(),
  update: jest.fn(),
  findFirst: jest.fn(),
  findMany: jest.fn(),
};

const mockClinicDelegate = { count: jest.fn() };
const mockPatientDelegate = { count: jest.fn(), findFirst: jest.fn(), update: jest.fn() };
const mockAppointmentDelegate = { count: jest.fn() };
const mockConversationDelegate = { count: jest.fn() };

const mockPrisma = {
  notification: mockNotificationDelegate,
  clinic: mockClinicDelegate,
  patient: mockPatientDelegate,
  appointment: mockAppointmentDelegate,
  conversation: mockConversationDelegate,
};

// ---------------------------------------------------------------------------
// Test Data
// ---------------------------------------------------------------------------

const TENANT_ID = '550e8400-e29b-41d4-a716-446655440000';
const CLINIC_ID = '550e8400-e29b-41d4-a716-446655440001';
const PATIENT_ID = '550e8400-e29b-41d4-a716-446655440002';
const NOTIF_ID = '550e8400-e29b-41d4-a716-446655440004';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('NotificationRepository', () => {
  let repo: NotificationRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new NotificationRepository(mockPrisma as any);
  });

  describe('create', () => {
    it('should call prisma.notification.create with mapped parameters', async () => {
      const notif = { id: NOTIF_ID };
      mockNotificationDelegate.create.mockResolvedValue(notif);

      const result = await repo.create({
        tenantId: TENANT_ID,
        clinicId: CLINIC_ID,
        recipient: 'test@example.com',
        channel: 'email',
        type: 'appointment_confirmation',
        content: 'hello',
        status: 'pending',
      });

      expect(mockNotificationDelegate.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            recipient: 'test@example.com',
            channel: 'email',
            status: 'pending',
          }),
        }),
      );
      expect(result).toBe(notif);
    });
  });

  describe('findPendingForDelivery', () => {
    it('should query for pending status and schedule constraints', async () => {
      mockNotificationDelegate.findMany.mockResolvedValue([]);
      await repo.findPendingForDelivery(10);

      expect(mockNotificationDelegate.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: expect.anything(),
            deletedAt: null,
          }),
          take: 10,
        }),
      );
    });
  });

  describe('getPatientPreferences', () => {
    it('should retrieve preferences fields from Patient record', async () => {
      mockPatientDelegate.findFirst.mockResolvedValue({
        smsEnabled: true,
        emailEnabled: false,
      });

      const result = await repo.getPatientPreferences(PATIENT_ID, TENANT_ID);

      expect(mockPatientDelegate.findFirst).toHaveBeenCalledWith({
        where: { id: PATIENT_ID, tenantId: TENANT_ID, deletedAt: null },
        select: {
          smsEnabled: true,
          emailEnabled: true,
          preferredLanguage: true,
          preferredContactMethod: true,
        },
      });
      expect(result).toEqual({ smsEnabled: true, emailEnabled: false });
    });
  });
});

/**
 * Healthcare Availability Engine — Explainable Slot Lifecycle & Real-Time Sync Tests
 */

import { AvailabilityService } from '../services/availability.service';

describe('AvailabilityService — Explainable Availability & 09:00 Slot Verification', () => {
  let service: AvailabilityService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      doctor: {
        findFirst: jest.fn(),
      },
      appointment: {
        findMany: jest.fn(),
      },
    };

    service = new AvailabilityService(mockPrisma);
  });

  it('should mark 09:00 as AVAILABLE when doctor starts at 09:00 and has no lunch break configured', async () => {
    mockPrisma.doctor.findFirst.mockResolvedValue({
      id: 'doc-1',
      tenantId: 'tenant-1',
      status: 'active',
      workingHours: [
        { dayOfWeek: 3, openTime: '09:00', closeTime: '17:00' }, // No lunch break specified
      ],
      leaves: [],
    });

    mockPrisma.appointment.findMany.mockResolvedValue([]);

    const result = await service.getAvailableSlots({
      tenantId: 'tenant-1',
      doctorId: 'doc-1',
      date: '2026-07-29',
      durationMinutes: 30,
    });

    const slot0900 = result.slots.find((s) => s.time === '09:00');
    expect(slot0900).toBeDefined();
    expect(slot0900?.available).toBe(true);
    expect(slot0900?.reason).toBeUndefined();
    expect(slot0900?.reasonCode).toBeUndefined();
  });

  it('should assign structured reasonCode DOCTOR_BREAK when explicit break is configured', async () => {
    mockPrisma.doctor.findFirst.mockResolvedValue({
      id: 'doc-1',
      tenantId: 'tenant-1',
      status: 'active',
      workingHours: [
        { dayOfWeek: 3, openTime: '09:00', closeTime: '17:00', breakStart: '13:00', breakEnd: '14:00' },
      ],
      leaves: [],
    });

    mockPrisma.appointment.findMany.mockResolvedValue([]);

    const result = await service.getAvailableSlots({
      tenantId: 'tenant-1',
      doctorId: 'doc-1',
      date: '2026-07-29',
      durationMinutes: 30,
    });

    const slot1300 = result.slots.find((s) => s.time === '13:00');
    expect(slot1300).toBeDefined();
    expect(slot1300?.available).toBe(false);
    expect(slot1300?.reasonCode).toBe('DOCTOR_BREAK');
    expect(slot1300?.reason).toContain('Lunch Break');
  });

  it('should assign structured reasonCode EXISTING_BOOKING for overlapping appointments', async () => {
    mockPrisma.doctor.findFirst.mockResolvedValue({
      id: 'doc-1',
      tenantId: 'tenant-1',
      status: 'active',
      workingHours: [
        { dayOfWeek: 3, openTime: '09:00', closeTime: '17:00' },
      ],
      leaves: [],
    });

    mockPrisma.appointment.findMany.mockResolvedValue([
      {
        id: 'apt-100',
        startTime: new Date('2026-07-29T10:00:00.000Z'),
        endTime: new Date('2026-07-29T10:30:00.000Z'),
      },
    ]);

    const result = await service.getAvailableSlots({
      tenantId: 'tenant-1',
      doctorId: 'doc-1',
      date: '2026-07-29',
      durationMinutes: 30,
    });

    const slot1000 = result.slots.find((s) => s.time === '10:00');
    expect(slot1000).toBeDefined();
    expect(slot1000?.available).toBe(false);
    expect(slot1000?.reasonCode).toBe('EXISTING_BOOKING');
  });

  it('should assign structured reasonCode OUTSIDE_WORKING_HOURS when duration extends past end time', async () => {
    mockPrisma.doctor.findFirst.mockResolvedValue({
      id: 'doc-1',
      tenantId: 'tenant-1',
      status: 'active',
      workingHours: [
        { dayOfWeek: 3, openTime: '09:00', closeTime: '17:00' },
      ],
      leaves: [],
    });

    mockPrisma.appointment.findMany.mockResolvedValue([]);

    const result = await service.getAvailableSlots({
      tenantId: 'tenant-1',
      doctorId: 'doc-1',
      date: '2026-07-29',
      durationMinutes: 60,
    });

    const slot1630 = result.slots.find((s) => s.time === '16:30');
    expect(slot1630).toBeDefined();
    expect(slot1630?.available).toBe(false);
    expect(slot1630?.reasonCode).toBe('OUTSIDE_WORKING_HOURS');
  });
});

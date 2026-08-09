/**
 * Healthcare Availability Engine — Duration-Aware & Continuous Scanning Unit Tests
 */

import { AvailabilityService } from '../services/availability.service';

describe('AvailabilityService — Duration-Aware & Continuous Scanning', () => {
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

  it('should fit 90-minute appointment only in continuous free windows', async () => {
    mockPrisma.doctor.findFirst.mockResolvedValue({
      id: 'doc-1',
      tenantId: 'tenant-1',
      status: 'active',
      workingHours: [
        { dayOfWeek: 3, startTime: '09:00', endTime: '17:00', breakStart: '12:00', breakEnd: '13:00' },
      ],
      leaves: [],
    });

    // Existing booking from 10:30 to 11:30
    mockPrisma.appointment.findMany.mockResolvedValue([
      {
        id: 'apt-1',
        startTime: new Date('2026-07-29T10:30:00.000Z'),
        endTime: new Date('2026-07-29T11:30:00.000Z'),
      },
    ]);

    const result = await service.getAvailableSlots({
      tenantId: 'tenant-1',
      doctorId: 'doc-1',
      date: '2026-07-29',
      durationMinutes: 90,
      stepMinutes: 30,
    });

    expect(result.durationMinutes).toBe(90);

    // 09:00 to 10:30 is 90 mins -> AVAILABLE
    const slot0900 = result.slots.find((s) => s.time === '09:00');
    expect(slot0900?.available).toBe(true);

    // 09:30 to 11:00 overlaps 10:30 booking -> UNAVAILABLE
    const slot0930 = result.slots.find((s) => s.time === '09:30');
    expect(slot0930?.available).toBe(false);
    expect(slot0930?.reason).toBe('Existing Booking');
    expect(slot0930?.reasonCode).toBe('EXISTING_BOOKING');

    // 10:00 to 11:30 overlaps 10:30 booking -> UNAVAILABLE
    const slot1000 = result.slots.find((s) => s.time === '10:00');
    expect(slot1000?.available).toBe(false);
    expect(slot1000?.reason).toBe('Existing Booking');
    expect(slot1000?.reasonCode).toBe('EXISTING_BOOKING');

    // 11:00 to 12:30 overlaps 12:00 lunch break -> UNAVAILABLE
    const slot1100 = result.slots.find((s) => s.time === '11:00');
    expect(slot1100?.available).toBe(false);
  });

  it('should exclude specified appointment when excludeAppointmentId is provided during rescheduling', async () => {
    mockPrisma.doctor.findFirst.mockResolvedValue({
      id: 'doc-1',
      tenantId: 'tenant-1',
      status: 'active',
      workingHours: [
        { dayOfWeek: 3, startTime: '09:00', endTime: '17:00', breakStart: '12:00', breakEnd: '13:00' },
      ],
      leaves: [],
    });

    mockPrisma.appointment.findMany.mockResolvedValue([]);

    const result = await service.getAvailableSlots({
      tenantId: 'tenant-1',
      doctorId: 'doc-1',
      date: '2026-07-29',
      durationMinutes: 60,
      excludeAppointmentId: 'apt-being-rescheduled',
    });

    const slot0900 = result.slots.find((s) => s.time === '09:00');
    expect(slot0900?.available).toBe(true);
    expect(mockPrisma.appointment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: { not: 'apt-being-rescheduled' },
        }),
      }),
    );
  });

  it('should filter out unavailable slots when excludeUnavailable is true', async () => {
    mockPrisma.doctor.findFirst.mockResolvedValue({
      id: 'doc-1',
      tenantId: 'tenant-1',
      status: 'active',
      workingHours: [
        { dayOfWeek: 3, startTime: '09:00', endTime: '17:00', breakStart: '12:00', breakEnd: '13:00' },
      ],
      leaves: [],
    });

    mockPrisma.appointment.findMany.mockResolvedValue([
      {
        id: 'apt-1',
        startTime: new Date('2026-07-29T09:00:00.000Z'),
        endTime: new Date('2026-07-29T12:00:00.000Z'),
      },
    ]);

    const result = await service.getAvailableSlots({
      tenantId: 'tenant-1',
      doctorId: 'doc-1',
      date: '2026-07-29',
      durationMinutes: 30,
      excludeUnavailable: true,
    });

    expect(result.slots.every((s) => s.available === true)).toBe(true);
    expect(result.slots.find((s) => s.time === '09:00')).toBeUndefined();
  });
});

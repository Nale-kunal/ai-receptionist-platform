/**
 * Healthcare Availability Calculation Engine
 *
 * Dynamically computes available time slots for doctors based on:
 * - Clinic-level operating hours (from configuration.business.businessHoursSchedule)
 * - Doctor-level working hours & day-of-week schedules
 * - Lunch breaks & blocked periods
 * - Leaves, holidays, & blackout dates
 * - Existing non-cancelled appointments
 * - Configurable slot duration (15, 20, 30, 45, 60 minutes)
 *
 * Priority: Clinic hours gate ALL availability. Doctor hours further restrict within clinic window.
 */

import type { PrismaClient } from '@prisma/client';
import { withDbRetry } from '../../../shared/database/dbRetry';
import { ACTIVE_APPOINTMENT_STATUSES } from '../../../shared/scheduling/schedulingOverlap';
import {
  parseHHmm,
  formatMinutes,
  intervalsOverlap,
  getLocalTimeDetails,
  DaySchedule,
  getEffectiveDoctorSchedule,
  EffectiveDoctorSchedule,
  dateStringToDayOfWeek,
} from '../../../shared/scheduling/doctorAvailabilityEngine';

export type UnavailableReasonCode =
  | 'CLINIC_CLOSED'
  | 'DOCTOR_OFF'
  | 'DOCTOR_BREAK'
  | 'EXISTING_BOOKING'
  | 'BUFFER_BEFORE'
  | 'BUFFER_AFTER'
  | 'HOLIDAY'
  | 'LEAVE'
  | 'OUTSIDE_WORKING_HOURS'
  | 'INSUFFICIENT_DURATION'
  | 'SOFT_RESERVED'
  | 'MAINTENANCE'
  | 'DOCTOR_SCHEDULE_CLOSED'
  | 'DOCTOR_ON_LEAVE'
  | 'DOCTOR_NOT_AVAILABLE';

export interface TimeSlot {
  time: string;           // "09:00"
  endTime: string;        // "10:30"
  durationMinutes: number;
  available: boolean;
  reason?: string;
  reasonCode?: UnavailableReasonCode;
}

export interface ClinicBusinessHour {
  dayOfWeek: number;      // 0=Sunday, 1=Monday, ..., 6=Saturday
  openTime: string;       // "09:00"
  closeTime: string;      // "17:00"
  isClosed: boolean;
}

export interface GetAvailabilityParams {
  tenantId: string;
  clinicId?: string;
  doctorId: string;
  date: string;           // "YYYY-MM-DD"
  durationMinutes?: number;
  appointmentType?: string;
  excludeAppointmentId?: string;
  excludeUnavailable?: boolean;
  stepMinutes?: number;
  bufferMinutes?: number;
  timezone?: string;
  /** Clinic-level business hours from configuration — acts as fallback default if doctor has no schedule */
  clinicBusinessHours?: ClinicBusinessHour[];
}

const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

function dateToLocalDateString(dateObj: Date | string, timeZone?: string): string {
  const d = typeof dateObj === 'string' ? new Date(dateObj) : dateObj;
  return getLocalTimeDetails(d, timeZone).dateStr;
}

function dateToLocalMinutes(dateObj: Date | string, timeZone?: string): number {
  const d = typeof dateObj === 'string' ? new Date(dateObj) : dateObj;
  return getLocalTimeDetails(d, timeZone).minutes;
}

export class AvailabilityService {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Calculates dynamic available slots for a given doctor and date.
   *
   * Authoritative Hierarchy:
   * - Doctor-specific weekly schedule is authoritative.
   * - Clinic hours act as fallback default if doctor has no schedule configured.
   * - Duration-aware continuous scanning guarantees that every returned slot
   *   fits the requested durationMinutes without overlapping breaks, leaves, or existing bookings.
   */
  public async getAvailableSlots(params: GetAvailabilityParams): Promise<{
    date: string;
    doctorId: string;
    durationMinutes: number;
    slots: TimeSlot[];
    workingHours: { start: string; end: string; breakStart?: string; breakEnd?: string; breaks?: any[] };
    clinicOpen: boolean;
    isOpen: boolean;
    status: 'OPEN' | 'DOCTOR_SCHEDULE_CLOSED' | 'DOCTOR_ON_LEAVE' | 'CLINIC_CLOSED' | 'NO_AVAILABLE_SLOTS' | 'DOCTOR_NOT_AVAILABLE';
    message: string;
    scheduleSource?: string;
  }> {
    const {
      tenantId,
      doctorId,
      date,
      durationMinutes = 30,
      excludeAppointmentId,
      excludeUnavailable = false,
      stepMinutes = 30,
      bufferMinutes = 0,
      clinicBusinessHours,
      timezone: inputTimezone,
    } = params;

    // 1. Fetch doctor details with tenant isolation and clinic timezone
    const doctor = await withDbRetry(() =>
      this.prisma.doctor.findFirst({
        where: {
          id: doctorId,
          tenantId,
          status: 'active',
          deletedAt: null,
        },
        include: {
          clinic: {
            select: { id: true, timezone: true },
          },
        },
      }),
    );

    if (!doctor) {
      throw new Error('Doctor not found, inactive, or unassigned.');
    }

    const timezone = doctor.clinic?.timezone || inputTimezone || 'UTC';

    // 2. Canonical Effective Doctor Schedule Resolution
    const effectiveSchedule = getEffectiveDoctorSchedule({
      doctor,
      date,
      timezone,
      clinicBusinessHours,
    });

    if (!effectiveSchedule.isOpen) {
      return {
        date,
        doctorId,
        durationMinutes,
        slots: [],
        workingHours: effectiveSchedule.workingHours,
        clinicOpen: effectiveSchedule.clinicOpen,
        isOpen: false,
        status: effectiveSchedule.status,
        message: effectiveSchedule.reason || 'Practitioner is not available on this date.',
        scheduleSource: effectiveSchedule.scheduleSource,
      };
    }

    const dayWorkingHours = effectiveSchedule.workingHours;

    if (parseHHmm(dayWorkingHours.start) >= parseHHmm(dayWorkingHours.end)) {
      return {
        date,
        doctorId,
        durationMinutes,
        slots: [],
        workingHours: dayWorkingHours,
        clinicOpen: effectiveSchedule.clinicOpen,
        isOpen: false,
        status: 'DOCTOR_SCHEDULE_CLOSED',
        message: 'This dentist is not working on this date.',
        scheduleSource: effectiveSchedule.scheduleSource,
      };
    }

    // 6. Query active existing appointments for the doctor covering target date window
    const targetDateStart = new Date(`${date}T00:00:00.000Z`);
    const searchWindowStart = new Date(targetDateStart.getTime() - 24 * 3600 * 1000);
    const searchWindowEnd = new Date(targetDateStart.getTime() + 48 * 3600 * 1000);
    const existingAppointments = await withDbRetry(() =>
      this.prisma.appointment.findMany({
        where: {
          tenantId,
          doctorId,
          status: { in: ACTIVE_APPOINTMENT_STATUSES as any },
          startTime: { gte: searchWindowStart, lte: searchWindowEnd },
          deletedAt: null,
          ...(excludeAppointmentId ? { id: { not: excludeAppointmentId } } : {}),
        },
        select: {
          id: true,
          startTime: true,
          endTime: true,
        },
      }),
    );

    // Convert existing DB appointment UTC timestamps to local day minutes for target date
    const parsedAppointments = existingAppointments
      .filter((apt) => {
        const aptDateStr = dateToLocalDateString(apt.startTime, timezone);
        return aptDateStr === date;
      })
      .map((apt) => {
        const startMin = dateToLocalMinutes(apt.startTime, timezone);
        let endMin = dateToLocalMinutes(apt.endTime, timezone);
        if (endMin <= startMin) endMin = startMin + 30; // Fallback
        return { id: apt.id, startMinutes: startMin, endMinutes: endMin };
      });

    // 7. Generate Time Slots using Duration-Aware Continuous Scanning & Explicit Break Detection
    const rawSlots: TimeSlot[] = [];
    const currentMinutes_start = parseHHmm(dayWorkingHours.start);
    const endMinutes = parseHHmm(dayWorkingHours.end);

    // Gather all active breaks
    const breaksList: Array<{ start: number; end: number; startStr: string; endStr: string }> = [];
    if (Array.isArray(dayWorkingHours.breaks) && dayWorkingHours.breaks.length > 0) {
      for (const b of dayWorkingHours.breaks) {
        if (b.start && b.end && parseHHmm(b.end) > parseHHmm(b.start)) {
          breaksList.push({ start: parseHHmm(b.start), end: parseHHmm(b.end), startStr: b.start, endStr: b.end });
        }
      }
    } else if (
      typeof dayWorkingHours.breakStart === 'string' &&
      typeof dayWorkingHours.breakEnd === 'string' &&
      dayWorkingHours.breakStart.trim().length > 0 &&
      dayWorkingHours.breakEnd.trim().length > 0 &&
      parseHHmm(dayWorkingHours.breakEnd) > parseHHmm(dayWorkingHours.breakStart)
    ) {
      breaksList.push({
        start: parseHHmm(dayWorkingHours.breakStart),
        end: parseHHmm(dayWorkingHours.breakEnd),
        startStr: dayWorkingHours.breakStart,
        endStr: dayWorkingHours.breakEnd,
      });
    }

    let currentMinutes = currentMinutes_start;
    const step = Math.max(5, stepMinutes);
    const buffer = Math.max(0, bufferMinutes);

    while (currentMinutes < endMinutes) {
      const slotStartMinutes = currentMinutes;
      const slotEndMinutes = currentMinutes + durationMinutes;

      const slotStartStr = formatMinutes(slotStartMinutes);
      const slotEndStr = formatMinutes(slotEndMinutes);

      let available = true;
      let reason: string | undefined = undefined;
      let reasonCode: UnavailableReasonCode | undefined = undefined;

      // Rule A: Full duration must fit within working hours
      if (slotEndMinutes > endMinutes) {
        available = false;
        reason = 'Exceeds Practitioner Working Hours';
        reasonCode = 'OUTSIDE_WORKING_HOURS';
      }

      // Rule B: Full duration must not overlap breaks / lunch periods
      if (available && breaksList.length > 0) {
        for (const brk of breaksList) {
          if (intervalsOverlap(slotStartMinutes, slotEndMinutes, brk.start, brk.end)) {
            available = false;
            reason = `Practitioner Lunch Break (${brk.startStr} to ${brk.endStr})`;
            reasonCode = 'DOCTOR_BREAK';
            break;
          }
        }
      }

      // Rule C: Full duration (+ buffer) must not overlap existing appointments
      if (available) {
        const overlaps = parsedAppointments.some((apt) => {
          const aptStartWithBuffer = apt.startMinutes - buffer;
          const aptEndWithBuffer = apt.endMinutes + buffer;
          return intervalsOverlap(slotStartMinutes, slotEndMinutes, aptStartWithBuffer, aptEndWithBuffer);
        });

        if (overlaps) {
          available = false;
          reason = 'Existing Booking';
          reasonCode = 'EXISTING_BOOKING';
        }
      }

      rawSlots.push({
        time: slotStartStr,
        endTime: slotEndStr,
        durationMinutes,
        available,
        reason,
        reasonCode,
      });

      currentMinutes += step;
    }

    const hasAvailable = rawSlots.some((s) => s.available);
    const finalSlots = excludeUnavailable
      ? rawSlots.filter((s) => s.available)
      : rawSlots;

    return {
      date,
      doctorId,
      durationMinutes,
      slots: finalSlots,
      workingHours: dayWorkingHours,
      clinicOpen: true,
      isOpen: true,
      status: hasAvailable ? 'OPEN' : 'NO_AVAILABLE_SLOTS',
      message: hasAvailable
        ? 'Slots available'
        : 'No available appointment slots for this doctor on this date.',
      scheduleSource: effectiveSchedule.scheduleSource,
    };
  }
}

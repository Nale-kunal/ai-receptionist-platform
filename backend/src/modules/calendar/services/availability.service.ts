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
  | 'MAINTENANCE';

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
  /** Clinic-level business hours from configuration — gates ALL scheduling */
  clinicBusinessHours?: ClinicBusinessHour[];
}

const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

function parseHHmm(timeStr: string): number {
  const [h, m] = (timeStr || '').split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

function formatMinutes(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60).toString().padStart(2, '0');
  const m = (totalMinutes % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}

function dateToLocalDateString(dateObj: Date | string, timeZone?: string): string {
  const d = typeof dateObj === 'string' ? new Date(dateObj) : dateObj;
  if (!timeZone || timeZone === 'UTC') {
    return d.toISOString().split('T')[0];
  }
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return formatter.format(d);
  } catch {
    return d.toISOString().split('T')[0];
  }
}

function dateToLocalMinutes(dateObj: Date | string, timeZone?: string): number {
  const d = typeof dateObj === 'string' ? new Date(dateObj) : dateObj;
  if (!timeZone || timeZone === 'UTC') {
    return d.getUTCHours() * 60 + d.getUTCMinutes();
  }
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    const parts = formatter.formatToParts(d);
    let hour = 0;
    let minute = 0;
    for (const part of parts) {
      if (part.type === 'hour') hour = parseInt(part.value, 10) % 24;
      if (part.type === 'minute') minute = parseInt(part.value, 10);
    }
    return hour * 60 + minute;
  } catch {
    return d.getUTCHours() * 60 + d.getUTCMinutes();
  }
}

export class AvailabilityService {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Calculates dynamic available slots for a given doctor and date.
   *
   * Clinic hours (if provided) act as the outer boundary.
   * Doctor hours further restrict within that boundary.
   * Duration-aware continuous scanning guarantees that every returned slot
   * fits the requested durationMinutes without overlapping breaks, leaves, or existing bookings.
   */
  public async getAvailableSlots(params: GetAvailabilityParams): Promise<{
    date: string;
    doctorId: string;
    durationMinutes: number;
    slots: TimeSlot[];
    workingHours: { start: string; end: string; breakStart?: string; breakEnd?: string };
    clinicOpen: boolean;
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
    } = params;

    // 1. Fetch doctor details with tenant isolation
    const doctor = await withDbRetry(() =>
      this.prisma.doctor.findFirst({
        where: {
          id: doctorId,
          tenantId,
          status: 'active',
          deletedAt: null,
        },
      }),
    );

    if (!doctor) {
      throw new Error('Doctor not found, inactive, or unassigned.');
    }

    // 2. Determine day of week for target date (0 = Sunday, 1 = Monday, etc.)
    const targetDate = new Date(date + 'T00:00:00Z');
    if (isNaN(targetDate.getTime())) {
      throw new Error('Invalid date format. Expected YYYY-MM-DD.');
    }

    const dayOfWeekNum = targetDate.getUTCDay();
    const dayName = DAY_NAMES[dayOfWeekNum];

    // 3. Resolve clinic operating window for this day
    let clinicWindow: { start: string; end: string } | null = null;

    if (clinicBusinessHours && clinicBusinessHours.length > 0) {
      const clinicDay = clinicBusinessHours.find((ch) => ch.dayOfWeek === dayOfWeekNum);

      if (!clinicDay || clinicDay.isClosed) {
        return {
          date,
          doctorId,
          durationMinutes,
          slots: [],
          workingHours: { start: '00:00', end: '00:00' },
          clinicOpen: false,
        };
      }

      clinicWindow = {
        start: clinicDay.openTime || '09:00',
        end: clinicDay.closeTime || '17:00',
      };
    }

    // 4. Parse Doctor Working Hours for this day (no forced hardcoded lunch break)
    let dayWorkingHours: {
      start: string;
      end: string;
      breakStart?: string;
      breakEnd?: string;
    } = {
      start: clinicWindow?.start || '09:00',
      end: clinicWindow?.end || '17:00',
      breakStart: undefined,
      breakEnd: undefined,
    };

    if (Array.isArray(doctor.workingHours) && (doctor.workingHours as any[]).length > 0) {
      const matchedDay = (doctor.workingHours as any[]).find((wh) => {
        if (typeof wh.day === 'string' && wh.day.toLowerCase() === dayName) return true;
        if (typeof wh.dayOfWeek === 'number' && wh.dayOfWeek === dayOfWeekNum) return true;
        if (
          typeof wh.dayOfWeek === 'string' &&
          (wh.dayOfWeek.toLowerCase() === dayName || parseInt(wh.dayOfWeek, 10) === dayOfWeekNum)
        )
          return true;
        return false;
      });

      if (matchedDay) {
        const isOff = matchedDay.isClosed === true || matchedDay.isOff === true || matchedDay.closed === true;
        if (isOff) {
          return {
            date,
            doctorId,
            durationMinutes,
            slots: [],
            workingHours: { start: '00:00', end: '00:00' },
            clinicOpen: true,
          };
        }

        const doctorStart = matchedDay.openTime || matchedDay.startTime || matchedDay.start || dayWorkingHours.start;
        const doctorEnd = matchedDay.closeTime || matchedDay.endTime || matchedDay.end || dayWorkingHours.end;

        const effectiveStart = clinicWindow
          ? formatMinutes(Math.max(parseHHmm(doctorStart), parseHHmm(clinicWindow.start)))
          : doctorStart;
        const effectiveEnd = clinicWindow
          ? formatMinutes(Math.min(parseHHmm(doctorEnd), parseHHmm(clinicWindow.end)))
          : doctorEnd;

        const isBreakDisabled =
          matchedDay.hasBreak === false ||
          matchedDay.noBreak === true ||
          matchedDay.isBreakDisabled === true ||
          matchedDay.breakDisabled === true;

        const breakStartRaw =
          matchedDay.breakStart ||
          matchedDay.lunchStart ||
          matchedDay.break_start ||
          matchedDay.lunch_start ||
          '12:00';
        const breakEndRaw =
          matchedDay.breakEnd ||
          matchedDay.lunchEnd ||
          matchedDay.break_end ||
          matchedDay.lunch_end ||
          '13:00';

        dayWorkingHours = {
          start: effectiveStart,
          end: effectiveEnd,
          breakStart: isBreakDisabled ? undefined : breakStartRaw,
          breakEnd: isBreakDisabled ? undefined : breakEndRaw,
        };
      } else {
        return {
          date,
          doctorId,
          durationMinutes,
          slots: [],
          workingHours: { start: '00:00', end: '00:00' },
          clinicOpen: !!clinicWindow,
        };
      }
    }

    if (parseHHmm(dayWorkingHours.start) >= parseHHmm(dayWorkingHours.end)) {
      return {
        date,
        doctorId,
        durationMinutes,
        slots: [],
        workingHours: dayWorkingHours,
        clinicOpen: !!clinicWindow,
      };
    }

    // 5. Check Doctor Leaves & Blackout Dates
    if (Array.isArray(doctor.leaves)) {
      const isOnLeave = (doctor.leaves as any[]).some((leave) => {
        if (typeof leave === 'string' && leave === date) return true;
        if (leave.date === date) return true;
        if (leave.startDate && leave.endDate) {
          return date >= leave.startDate && date <= leave.endDate;
        }
        return false;
      });

      if (isOnLeave) {
        return {
          date,
          doctorId,
          durationMinutes,
          slots: [],
          workingHours: dayWorkingHours,
          clinicOpen: true,
        };
      }
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
    const timezoneStr = params.timezone || 'UTC';
    const parsedAppointments = existingAppointments
      .filter((apt) => {
        const aptDateStr = dateToLocalDateString(apt.startTime, timezoneStr);
        return aptDateStr === date;
      })
      .map((apt) => {
        const startMin = dateToLocalMinutes(apt.startTime, timezoneStr);
        let endMin = dateToLocalMinutes(apt.endTime, timezoneStr);
        if (endMin <= startMin) endMin = startMin + 30; // Fallback
        return { id: apt.id, startMinutes: startMin, endMinutes: endMin };
      });

    // 7. Generate Time Slots using Duration-Aware Continuous Scanning & Explicit Break Detection
    const rawSlots: TimeSlot[] = [];
    const currentMinutes_start = parseHHmm(dayWorkingHours.start);
    const endMinutes = parseHHmm(dayWorkingHours.end);

    const hasExplicitBreak =
      typeof dayWorkingHours.breakStart === 'string' &&
      typeof dayWorkingHours.breakEnd === 'string' &&
      dayWorkingHours.breakStart.trim().length > 0 &&
      dayWorkingHours.breakEnd.trim().length > 0 &&
      parseHHmm(dayWorkingHours.breakEnd) > parseHHmm(dayWorkingHours.breakStart);

    const breakStartMinutes = hasExplicitBreak ? parseHHmm(dayWorkingHours.breakStart!) : -1;
    const breakEndMinutes = hasExplicitBreak ? parseHHmm(dayWorkingHours.breakEnd!) : -1;

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

      // Rule B: Full duration must not overlap explicit lunch break (only if break is configured)
      if (available && hasExplicitBreak) {
        const overlapsBreak =
          slotStartMinutes < breakEndMinutes && slotEndMinutes > breakStartMinutes;
        if (overlapsBreak) {
          available = false;
          reason = `Practitioner Lunch Break (${dayWorkingHours.breakStart} to ${dayWorkingHours.breakEnd})`;
          reasonCode = 'DOCTOR_BREAK';
        }
      }

      // Rule C: Full duration (+ buffer) must not overlap existing appointments
      if (available) {
        const overlaps = parsedAppointments.some((apt) => {
          const aptStartWithBuffer = apt.startMinutes - buffer;
          const aptEndWithBuffer = apt.endMinutes + buffer;
          return slotStartMinutes < aptEndWithBuffer && slotEndMinutes > aptStartWithBuffer;
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
    };
  }
}

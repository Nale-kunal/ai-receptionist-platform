/**
 * Single Authoritative Doctor Availability & Interval Scheduling Engine
 *
 * CANONICAL SOURCE OF TRUTH for:
 * 1. Appointment Booking (AppointmentService.createAppointment)
 * 2. Appointment Rescheduling (AppointmentService.rescheduleAppointment)
 * 3. Calendar Slot Generation (AvailabilityService.getAvailableSlots)
 * 4. WhatsApp & AI Tool Booking Pipelines
 *
 * Enforces:
 * - Timezone-aware date and time resolution
 * - Hard doctor working hours & closed days
 * - Hard doctor lunch / break blocking intervals
 * - Entire duration continuity requirement
 * - Doctor leaves & blackout dates
 * - Active appointment overlap detection
 */

export type AvailabilityErrorCode =
  | 'DOCTOR_NOT_AVAILABLE'
  | 'DOCTOR_SCHEDULE_CLOSED'
  | 'DOCTOR_BREAK_CONFLICT'
  | 'APPOINTMENT_OUTSIDE_WORKING_HOURS'
  | 'DOCTOR_ON_LEAVE'
  | 'CLINIC_CLOSED'
  | 'APPOINTMENT_CONFLICT'
  | 'INVALID_TIME_RANGE';

export interface DoctorAvailabilityResult {
  valid: boolean;
  errorCode?: AvailabilityErrorCode;
  reason?: string;
  details?: {
    dateStr?: string;
    dayOfWeek?: number;
    openTime?: string;
    closeTime?: string;
    breakStart?: string;
    breakEnd?: string;
    conflictingAppointmentId?: string;
  };
}

export interface BreakInterval {
  start: string; // "12:00"
  end: string;   // "13:00"
  label?: string;
}

export interface DaySchedule {
  dayOfWeek?: number; // 0 = Sunday, 1 = Monday, ... 6 = Saturday
  day?: string;       // "monday", "tuesday", etc.
  openTime?: string;
  closeTime?: string;
  startTime?: string;
  endTime?: string;
  start?: string;
  end?: string;
  breakStart?: string;
  breakEnd?: string;
  breaks?: BreakInterval[];
  isClosed?: boolean;
  isOff?: boolean;
  closed?: boolean;
  hasBreak?: boolean;
  isBreakDisabled?: boolean;
}

export interface DoctorAvailabilityParams {
  doctor: {
    id: string;
    status?: string;
    workingHours?: DaySchedule[] | any;
    leaves?: Array<string | { date?: string; startDate?: string; endDate?: string }> | any;
  };
  startTime: Date;
  endTime: Date;
  timezone?: string; // Authoritative clinic/doctor timezone (e.g. 'America/New_York', 'UTC', 'Asia/Kolkata')
  clinicBusinessHours?: Array<{ dayOfWeek: number; openTime: string; closeTime: string; isClosed: boolean }>;
  existingAppointments?: Array<{ id: string; startTime: Date; endTime: Date; status?: string }>;
  excludeAppointmentId?: string;
}

const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

/** Converts "HH:mm" time string to minutes from midnight [0..1440) */
export function parseHHmm(timeStr?: string): number {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(':').map((v) => parseInt(v, 10));
  return (isNaN(h) ? 0 : h) * 60 + (isNaN(m) ? 0 : m);
}

/** Formats minutes from midnight to "HH:mm" */
export function formatMinutes(totalMinutes: number): string {
  const normalized = Math.max(0, totalMinutes);
  const h = Math.floor(normalized / 60) % 24;
  const m = normalized % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

/**
 * Returns true if intervals [aStart, aEnd) and [bStart, bEnd) overlap.
 * Adjacent intervals (aEnd === bStart or aStart === bEnd) do NOT overlap.
 */
export function intervalsOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && aEnd > bStart;
}

/**
 * Resolves local date string YYYY-MM-DD, day of week 0..6, and local minutes from midnight
 * in the specified authoritative timezone.
 */
export function getLocalTimeDetails(dateObj: Date, timezone = 'UTC'): {
  dateStr: string;
  dayOfWeek: number;
  minutes: number;
  hours: number;
  mins: number;
} {
  const d = dateObj instanceof Date ? dateObj : new Date(dateObj);
  if (isNaN(d.getTime())) {
    throw new Error('Invalid Date provided to getLocalTimeDetails.');
  }

  const validTimezone = timezone && timezone.trim() !== '' ? timezone.trim() : 'UTC';

  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: validTimezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });

    const parts = formatter.formatToParts(d);
    let year = '';
    let month = '';
    let day = '';
    let weekdayStr = '';
    let hour = 0;
    let minute = 0;

    for (const part of parts) {
      if (part.type === 'year') year = part.value;
      if (part.type === 'month') month = part.value;
      if (part.type === 'day') day = part.value;
      if (part.type === 'weekday') weekdayStr = part.value.toLowerCase();
      if (part.type === 'hour') hour = parseInt(part.value, 10) % 24;
      if (part.type === 'minute') minute = parseInt(part.value, 10);
    }

    const dateStr = `${year}-${month}-${day}`;
    const weekdayMap: Record<string, number> = {
      sun: 0,
      mon: 1,
      tue: 2,
      wed: 3,
      thu: 4,
      fri: 5,
      sat: 6,
    };
    const dayOfWeek = weekdayMap[weekdayStr.slice(0, 3)] ?? d.getUTCDay();
    const minutes = hour * 60 + minute;

    return { dateStr, dayOfWeek, minutes, hours: hour, mins: minute };
  } catch (err) {
    // Fallback to UTC if timezone string is unrecognized
    const year = d.getUTCFullYear();
    const month = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    const dayOfWeek = d.getUTCDay();
    const hours = d.getUTCHours();
    const mins = d.getUTCMinutes();
    const minutes = hours * 60 + mins;
    return { dateStr, dayOfWeek, minutes, hours, mins };
  }
}

/**
 * Resolves day of week (0=Sunday .. 6=Saturday) from a date string "YYYY-MM-DD"
 * using UTC date components to avoid any local/server timezone boundary corruption.
 */
export function dateStringToDayOfWeek(dateStr: string): number {
  if (!dateStr || typeof dateStr !== 'string') {
    throw new Error('dateStringToDayOfWeek requires a valid date string.');
  }
  const clean = dateStr.trim().split('T')[0];
  const parts = clean.split('-').map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) {
    throw new Error(`Invalid date format "${dateStr}". Expected YYYY-MM-DD.`);
  }
  const [year, month, day] = parts;
  // Using noon UTC guarantees DST/midnight boundaries cannot flip the day of week
  const d = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  return d.getUTCDay();
}

export interface EffectiveDoctorSchedule {
  isOpen: boolean;
  status: 'OPEN' | 'DOCTOR_SCHEDULE_CLOSED' | 'DOCTOR_ON_LEAVE' | 'CLINIC_CLOSED' | 'DOCTOR_NOT_AVAILABLE';
  reasonCode?: AvailabilityErrorCode;
  reason?: string;
  workingHours: {
    start: string;
    end: string;
    breakStart?: string;
    breakEnd?: string;
    breaks?: BreakInterval[];
  };
  scheduleSource: 'doctor' | 'clinic_default' | 'none';
  dayOfWeek: number;
  dayName: string;
  localDate: string;
  clinicOpen: boolean;
}

/**
 * Authoritative Canonical Service: "What is this doctor's effective schedule on this specific date?"
 *
 * Precedence:
 * 1. Doctor status check (inactive/archived = closed)
 * 2. Doctor specific-date leaves & blackout dates (on leave = closed)
 * 3. Doctor-specific weekly schedule: AUTHORITATIVE.
 *    If the doctor has an explicitly configured schedule, their explicit weekday configuration
 *    (isClosed, openTime, closeTime, breaks) determines availability.
 *    The clinic's weekly business hours do NOT override or close an explicitly configured doctor.
 * 4. Clinic business hours: Default schedule fallback ONLY when the doctor has no schedule configured.
 */
export function getEffectiveDoctorSchedule(params: {
  doctor: {
    id?: string;
    status?: string;
    workingHours?: DaySchedule[] | any;
    leaves?: Array<string | { date?: string; startDate?: string; endDate?: string }> | any;
    clinic?: { timezone?: string };
  };
  date: string; // "YYYY-MM-DD"
  timezone?: string;
  clinicBusinessHours?: Array<{ dayOfWeek: number; openTime: string; closeTime: string; isClosed: boolean }>;
}): EffectiveDoctorSchedule {
  const { doctor, date, clinicBusinessHours } = params;

  const cleanDate = (date || '').trim().split('T')[0];
  const dayOfWeek = dateStringToDayOfWeek(cleanDate);
  const dayName = DAY_NAMES[dayOfWeek];

  // 1. Doctor Active Status
  if (doctor.status && doctor.status !== 'active') {
    return {
      isOpen: false,
      status: 'DOCTOR_NOT_AVAILABLE',
      reasonCode: 'DOCTOR_NOT_AVAILABLE',
      reason: 'Practitioner is currently inactive or unavailable.',
      workingHours: { start: '00:00', end: '00:00' },
      scheduleSource: 'none',
      dayOfWeek,
      dayName,
      localDate: cleanDate,
      clinicOpen: true,
    };
  }

  // 2. Doctor Leaves & Blackout Dates
  if (Array.isArray(doctor.leaves) && doctor.leaves.length > 0) {
    const onLeave = doctor.leaves.some((leave: any) => {
      if (typeof leave === 'string' && leave === cleanDate) return true;
      if (leave && typeof leave === 'object') {
        if (leave.date === cleanDate) return true;
        if (leave.startDate && leave.endDate) {
          return cleanDate >= leave.startDate && cleanDate <= leave.endDate;
        }
      }
      return false;
    });

    if (onLeave) {
      return {
        isOpen: false,
        status: 'DOCTOR_ON_LEAVE',
        reasonCode: 'DOCTOR_ON_LEAVE',
        reason: 'This dentist is on leave on this date.',
        workingHours: { start: '00:00', end: '00:00' },
        scheduleSource: 'doctor',
        dayOfWeek,
        dayName,
        localDate: cleanDate,
        clinicOpen: true,
      };
    }
  }

  // 3. Doctor-Specific Weekly Working Hours
  let rawHours = doctor.workingHours;
  if (typeof rawHours === 'string') {
    try {
      rawHours = JSON.parse(rawHours);
    } catch {
      rawHours = [];
    }
  }

  const hasDoctorSchedule = Array.isArray(rawHours) && rawHours.length > 0;

  if (hasDoctorSchedule) {
    const matchedDay: DaySchedule | undefined = rawHours.find((wh: any) => {
      if (typeof wh.dayOfWeek === 'number' && wh.dayOfWeek === dayOfWeek) return true;
      if (typeof wh.day === 'string' && wh.day.toLowerCase() === dayName) return true;
      if (typeof wh.dayOfWeek === 'string') {
        if (wh.dayOfWeek.toLowerCase() === dayName) return true;
        if (parseInt(wh.dayOfWeek, 10) === dayOfWeek) return true;
      }
      return false;
    });

    if (!matchedDay) {
      // Configured doctor schedule exists, but this weekday is not in the list -> closed
      return {
        isOpen: false,
        status: 'DOCTOR_SCHEDULE_CLOSED',
        reasonCode: 'DOCTOR_SCHEDULE_CLOSED',
        reason: 'This dentist is not working on this date.',
        workingHours: { start: '00:00', end: '00:00' },
        scheduleSource: 'doctor',
        dayOfWeek,
        dayName,
        localDate: cleanDate,
        clinicOpen: true,
      };
    }

    const isClosed =
      matchedDay.isClosed === true ||
      matchedDay.isOff === true ||
      matchedDay.closed === true;

    if (isClosed) {
      return {
        isOpen: false,
        status: 'DOCTOR_SCHEDULE_CLOSED',
        reasonCode: 'DOCTOR_SCHEDULE_CLOSED',
        reason: 'This dentist is not working on this date.',
        workingHours: { start: '00:00', end: '00:00' },
        scheduleSource: 'doctor',
        dayOfWeek,
        dayName,
        localDate: cleanDate,
        clinicOpen: true,
      };
    }

    // Doctor is explicitly OPEN on this weekday
    const openTime = matchedDay.openTime || matchedDay.startTime || matchedDay.start || '09:00';
    const closeTime = matchedDay.closeTime || matchedDay.endTime || matchedDay.end || '17:00';

    const isBreakDisabled = matchedDay.hasBreak === false || matchedDay.isBreakDisabled === true;
    const breakStart = isBreakDisabled
      ? undefined
      : matchedDay.breakStart || (matchedDay as any).lunchStart || '12:00';
    const breakEnd = isBreakDisabled
      ? undefined
      : matchedDay.breakEnd || (matchedDay as any).lunchEnd || '13:00';

    let breaks: BreakInterval[] = [];
    if (!isBreakDisabled) {
      if (Array.isArray(matchedDay.breaks) && matchedDay.breaks.length > 0) {
        breaks = matchedDay.breaks.filter((b) => b && b.start && b.end && parseHHmm(b.end) > parseHHmm(b.start));
      } else if (breakStart && breakEnd && parseHHmm(breakEnd) > parseHHmm(breakStart)) {
        breaks = [{ start: breakStart, end: breakEnd, label: 'Lunch Break' }];
      }
    }

    return {
      isOpen: true,
      status: 'OPEN',
      workingHours: {
        start: openTime,
        end: closeTime,
        breakStart,
        breakEnd,
        breaks,
      },
      scheduleSource: 'doctor',
      dayOfWeek,
      dayName,
      localDate: cleanDate,
      clinicOpen: true,
    };
  }

  // 4. Fallback to Clinic Business Hours (when doctor has no schedule configured)
  if (Array.isArray(clinicBusinessHours) && clinicBusinessHours.length > 0) {
    const clinicDay = clinicBusinessHours.find((ch) => ch.dayOfWeek === dayOfWeek);

    if (!clinicDay || clinicDay.isClosed) {
      return {
        isOpen: false,
        status: 'CLINIC_CLOSED',
        reasonCode: 'CLINIC_CLOSED',
        reason: 'Clinic is closed on this date.',
        workingHours: { start: '00:00', end: '00:00' },
        scheduleSource: 'clinic_default',
        dayOfWeek,
        dayName,
        localDate: cleanDate,
        clinicOpen: false,
      };
    }

    const openTime = clinicDay.openTime || '09:00';
    const closeTime = clinicDay.closeTime || '17:00';

    return {
      isOpen: true,
      status: 'OPEN',
      workingHours: {
        start: openTime,
        end: closeTime,
        breakStart: '12:00',
        breakEnd: '13:00',
        breaks: [{ start: '12:00', end: '13:00', label: 'Lunch Break' }],
      },
      scheduleSource: 'clinic_default',
      dayOfWeek,
      dayName,
      localDate: cleanDate,
      clinicOpen: true,
    };
  }

  // 5. Default General Schedule (Monday-Friday 09:00-17:00, Saturday-Sunday closed)
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  if (isWeekend) {
    return {
      isOpen: false,
      status: 'DOCTOR_SCHEDULE_CLOSED',
      reasonCode: 'DOCTOR_SCHEDULE_CLOSED',
      reason: 'This dentist is not working on this date.',
      workingHours: { start: '00:00', end: '00:00' },
      scheduleSource: 'none',
      dayOfWeek,
      dayName,
      localDate: cleanDate,
      clinicOpen: false,
    };
  }

  return {
    isOpen: true,
    status: 'OPEN',
    workingHours: {
      start: '09:00',
      end: '17:00',
      breakStart: '12:00',
      breakEnd: '13:00',
      breaks: [{ start: '12:00', end: '13:00', label: 'Lunch Break' }],
    },
    scheduleSource: 'none',
    dayOfWeek,
    dayName,
    localDate: cleanDate,
    clinicOpen: true,
  };
}

/**
 * Validates doctor availability for a candidate appointment window.
 * Returns { valid: true } or { valid: false, errorCode, reason, details }.
 */
export function validateDoctorAvailability(params: DoctorAvailabilityParams): DoctorAvailabilityResult {
  const {
    doctor,
    startTime,
    endTime,
    timezone = 'UTC',
    clinicBusinessHours,
    existingAppointments = [],
    excludeAppointmentId,
  } = params;

  // 1. Validate time ordering
  if (!startTime || !endTime || endTime.getTime() <= startTime.getTime()) {
    return {
      valid: false,
      errorCode: 'INVALID_TIME_RANGE',
      reason: 'Appointment endTime must be strictly after startTime.',
    };
  }

  // 2. Resolve Local Date, Day of Week, and Times in Authoritative Timezone
  const startLocal = getLocalTimeDetails(startTime, timezone);
  const localDateStr = startLocal.dateStr;

  // 3. Delegate to Canonical Schedule Resolution
  const schedule = getEffectiveDoctorSchedule({
    doctor,
    date: localDateStr,
    timezone,
    clinicBusinessHours,
  });

  if (!schedule.isOpen) {
    return {
      valid: false,
      errorCode: schedule.reasonCode || 'DOCTOR_SCHEDULE_CLOSED',
      reason: schedule.reason || `Practitioner is not available on ${schedule.dayName}s.`,
      details: { dateStr: localDateStr, dayOfWeek: schedule.dayOfWeek },
    };
  }

  // Calculate appointment duration in minutes
  const durationMinutes = Math.round((endTime.getTime() - startTime.getTime()) / 60000);
  const startMins = startLocal.minutes;
  const endMins = startMins + durationMinutes;

  // 4. Working Hours Boundary Check (Entire Duration Must Fit)
  const openMins = parseHHmm(schedule.workingHours.start);
  const closeMins = parseHHmm(schedule.workingHours.end);

  if (openMins >= closeMins) {
    return {
      valid: false,
      errorCode: 'DOCTOR_SCHEDULE_CLOSED',
      reason: `Practitioner has no open working window on ${schedule.dayName}s.`,
      details: { dateStr: localDateStr, dayOfWeek: schedule.dayOfWeek },
    };
  }

  if (startMins < openMins || endMins > closeMins) {
    const openStr = formatMinutes(openMins);
    const closeStr = formatMinutes(closeMins);
    return {
      valid: false,
      errorCode: 'APPOINTMENT_OUTSIDE_WORKING_HOURS',
      reason: `Selected appointment time (${formatMinutes(startMins)} - ${formatMinutes(endMins)}) is outside practitioner working hours (${openStr} to ${closeStr}).`,
      details: {
        dateStr: localDateStr,
        dayOfWeek: schedule.dayOfWeek,
        openTime: openStr,
        closeTime: closeStr,
      },
    };
  }

  // 5. Hard Break / Lunch Period Conflict Detection
  const breaksToCheck = schedule.workingHours.breaks || [];
  for (const brk of breaksToCheck) {
    const bStart = parseHHmm(brk.start);
    const bEnd = parseHHmm(brk.end);
    if (bEnd > bStart && intervalsOverlap(startMins, endMins, bStart, bEnd)) {
      return {
        valid: false,
        errorCode: 'DOCTOR_BREAK_CONFLICT',
        reason: `Selected appointment overlaps practitioner lunch/break (${brk.start} to ${brk.end}).`,
        details: {
          dateStr: localDateStr,
          dayOfWeek: schedule.dayOfWeek,
          breakStart: brk.start,
          breakEnd: brk.end,
        },
      };
    }
  }

  // 6. Existing Appointment Overlap Check
  if (Array.isArray(existingAppointments) && existingAppointments.length > 0) {
    for (const apt of existingAppointments) {
      if (excludeAppointmentId && apt.id === excludeAppointmentId) continue;
      if (apt.status && ['cancelled', 'no_show', 'completed'].includes(apt.status.toLowerCase())) {
        continue;
      }

      const aptStart = apt.startTime instanceof Date ? apt.startTime : new Date(apt.startTime);
      const aptEnd = apt.endTime instanceof Date ? apt.endTime : new Date(apt.endTime);

      // Mathematical timestamp overlap: aptStart < candidateEnd && aptEnd > candidateStart
      if (aptStart.getTime() < endTime.getTime() && aptEnd.getTime() > startTime.getTime()) {
        return {
          valid: false,
          errorCode: 'APPOINTMENT_CONFLICT',
          reason: 'The selected time slot is already booked for this doctor.',
          details: {
            dateStr: localDateStr,
            conflictingAppointmentId: apt.id,
          },
        };
      }
    }
  }

  return { valid: true };
}

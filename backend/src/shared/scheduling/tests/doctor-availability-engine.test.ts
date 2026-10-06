/**
 * Doctor Availability Engine Unit Tests
 *
 * Exhaustively tests:
 * 1. Valid booking within working hours
 * 2. Appointments adjacent to lunch break (ending at 12:00 or starting at 13:00)
 * 3. Appointments overlapping lunch break (12:00-13:00, 11:45-12:15, 12:45-13:15, 11:30-13:30)
 * 4. Appointments outside working hours (before openTime, after closeTime, spanning closeTime)
 * 5. Closed days (e.g. Saturday, Sunday)
 * 6. Doctor on leave / blackout dates
 * 7. Multi-break schedule configurations
 * 8. Timezone-aware date calculations
 * 9. Existing overlapping appointments
 */

import {
  validateDoctorAvailability,
  intervalsOverlap,
  parseHHmm,
  formatMinutes,
  getLocalTimeDetails,
  getEffectiveDoctorSchedule,
  dateStringToDayOfWeek,
} from '../doctorAvailabilityEngine';

describe('Doctor Availability Engine', () => {
  const standardDoctor = {
    id: 'doc-100',
    status: 'active',
    workingHours: [
      {
        dayOfWeek: 1, // Monday
        openTime: '09:00',
        closeTime: '17:00',
        breakStart: '12:00',
        breakEnd: '13:00',
        isClosed: false,
      },
      {
        dayOfWeek: 2, // Tuesday
        openTime: '09:00',
        closeTime: '17:00',
        breakStart: '12:00',
        breakEnd: '13:00',
        isClosed: false,
      },
      {
        dayOfWeek: 3, // Wednesday
        openTime: '09:00',
        closeTime: '17:00',
        breakStart: '12:00',
        breakEnd: '13:00',
        isClosed: false,
      },
      {
        dayOfWeek: 4, // Thursday
        openTime: '09:00',
        closeTime: '17:00',
        breakStart: '12:00',
        breakEnd: '13:00',
        isClosed: false,
      },
      {
        dayOfWeek: 5, // Friday
        openTime: '09:00',
        closeTime: '17:00',
        breakStart: '12:00',
        breakEnd: '13:00',
        isClosed: false,
      },
      {
        dayOfWeek: 6, // Saturday
        isClosed: true,
      },
      {
        dayOfWeek: 0, // Sunday
        isClosed: true,
      },
    ],
    leaves: [
      { startDate: '2026-12-25', endDate: '2026-12-26', reason: 'Holiday' },
    ],
  };

  // 2026-09-07 is a Monday
  const MONDAY = '2026-09-07';
  const SATURDAY = '2026-09-12';

  describe('Interval Math & Overlap Helpers', () => {
    it('should correctly parse HH:mm to minutes from midnight', () => {
      expect(parseHHmm('00:00')).toBe(0);
      expect(parseHHmm('09:00')).toBe(540);
      expect(parseHHmm('12:00')).toBe(720);
      expect(parseHHmm('13:00')).toBe(780);
      expect(parseHHmm('17:00')).toBe(1020);
      expect(parseHHmm('23:59')).toBe(1439);
    });

    it('should format minutes to HH:mm correctly', () => {
      expect(formatMinutes(0)).toBe('00:00');
      expect(formatMinutes(540)).toBe('09:00');
      expect(formatMinutes(720)).toBe('12:00');
      expect(formatMinutes(780)).toBe('13:00');
      expect(formatMinutes(1020)).toBe('17:00');
    });

    it('should correctly identify overlapping vs adjacent intervals', () => {
      // Overlapping
      expect(intervalsOverlap(700, 730, 720, 780)).toBe(true); // 11:40-12:10 vs 12:00-13:00
      expect(intervalsOverlap(720, 750, 720, 780)).toBe(true); // 12:00-12:30 vs 12:00-13:00
      expect(intervalsOverlap(750, 800, 720, 780)).toBe(true); // 12:30-13:20 vs 12:00-13:00
      expect(intervalsOverlap(700, 800, 720, 780)).toBe(true); // 11:40-13:20 vs 12:00-13:00

      // Non-overlapping (strictly before or after)
      expect(intervalsOverlap(600, 660, 720, 780)).toBe(false); // 10:00-11:00 vs 12:00-13:00
      expect(intervalsOverlap(800, 860, 720, 780)).toBe(false); // 13:20-14:20 vs 12:00-13:00

      // Adjacent (touching boundaries is ALLOWED and NOT overlapping)
      expect(intervalsOverlap(660, 720, 720, 780)).toBe(false); // 11:00-12:00 vs 12:00-13:00
      expect(intervalsOverlap(780, 840, 720, 780)).toBe(false); // 13:00-14:00 vs 12:00-13:00
    });
  });

  describe('Lunch / Break Period Enforcement', () => {
    it('ALLOWS appointment completely before lunch (09:00 - 09:30)', () => {
      const res = validateDoctorAvailability({
        doctor: standardDoctor,
        startTime: new Date(`${MONDAY}T09:00:00Z`),
        endTime: new Date(`${MONDAY}T09:30:00Z`),
        timezone: 'UTC',
      });
      expect(res.valid).toBe(true);
    });

    it('ALLOWS appointment ending exactly when lunch begins (11:30 - 12:00)', () => {
      const res = validateDoctorAvailability({
        doctor: standardDoctor,
        startTime: new Date(`${MONDAY}T11:30:00Z`),
        endTime: new Date(`${MONDAY}T12:00:00Z`),
        timezone: 'UTC',
      });
      expect(res.valid).toBe(true);
    });

    it('ALLOWS appointment starting exactly when lunch ends (13:00 - 13:30)', () => {
      const res = validateDoctorAvailability({
        doctor: standardDoctor,
        startTime: new Date(`${MONDAY}T13:00:00Z`),
        endTime: new Date(`${MONDAY}T13:30:00Z`),
        timezone: 'UTC',
      });
      expect(res.valid).toBe(true);
    });

    it('REJECTS appointment completely inside lunch (12:00 - 12:30)', () => {
      const res = validateDoctorAvailability({
        doctor: standardDoctor,
        startTime: new Date(`${MONDAY}T12:00:00Z`),
        endTime: new Date(`${MONDAY}T12:30:00Z`),
        timezone: 'UTC',
      });
      expect(res.valid).toBe(false);
      expect(res.errorCode).toBe('DOCTOR_BREAK_CONFLICT');
      expect(res.reason).toContain('overlaps practitioner lunch/break');
    });

    it('REJECTS second half of lunch (12:30 - 13:00)', () => {
      const res = validateDoctorAvailability({
        doctor: standardDoctor,
        startTime: new Date(`${MONDAY}T12:30:00Z`),
        endTime: new Date(`${MONDAY}T13:00:00Z`),
        timezone: 'UTC',
      });
      expect(res.valid).toBe(false);
      expect(res.errorCode).toBe('DOCTOR_BREAK_CONFLICT');
    });

    it('REJECTS appointment overlapping lunch start by 15 mins (11:45 - 12:15)', () => {
      const res = validateDoctorAvailability({
        doctor: standardDoctor,
        startTime: new Date(`${MONDAY}T11:45:00Z`),
        endTime: new Date(`${MONDAY}T12:15:00Z`),
        timezone: 'UTC',
      });
      expect(res.valid).toBe(false);
      expect(res.errorCode).toBe('DOCTOR_BREAK_CONFLICT');
    });

    it('REJECTS appointment starting inside lunch and ending after (12:45 - 13:15)', () => {
      const res = validateDoctorAvailability({
        doctor: standardDoctor,
        startTime: new Date(`${MONDAY}T12:45:00Z`),
        endTime: new Date(`${MONDAY}T13:15:00Z`),
        timezone: 'UTC',
      });
      expect(res.valid).toBe(false);
      expect(res.errorCode).toBe('DOCTOR_BREAK_CONFLICT');
    });

    it('REJECTS long appointment spanning entire lunch (11:30 - 13:30)', () => {
      const res = validateDoctorAvailability({
        doctor: standardDoctor,
        startTime: new Date(`${MONDAY}T11:30:00Z`),
        endTime: new Date(`${MONDAY}T13:30:00Z`),
        timezone: 'UTC',
      });
      expect(res.valid).toBe(false);
      expect(res.errorCode).toBe('DOCTOR_BREAK_CONFLICT');
    });
  });

  describe('Working Hours & Closed Days Enforcement', () => {
    it('REJECTS appointment before opening time (08:30 - 09:00)', () => {
      const res = validateDoctorAvailability({
        doctor: standardDoctor,
        startTime: new Date(`${MONDAY}T08:30:00Z`),
        endTime: new Date(`${MONDAY}T09:00:00Z`),
        timezone: 'UTC',
      });
      expect(res.valid).toBe(false);
      expect(res.errorCode).toBe('APPOINTMENT_OUTSIDE_WORKING_HOURS');
    });

    it('REJECTS appointment spanning past closing time (16:45 - 17:15)', () => {
      const res = validateDoctorAvailability({
        doctor: standardDoctor,
        startTime: new Date(`${MONDAY}T16:45:00Z`),
        endTime: new Date(`${MONDAY}T17:15:00Z`),
        timezone: 'UTC',
      });
      expect(res.valid).toBe(false);
      expect(res.errorCode).toBe('APPOINTMENT_OUTSIDE_WORKING_HOURS');
    });

    it('ALLOWS appointment ending exactly at closing time (16:30 - 17:00)', () => {
      const res = validateDoctorAvailability({
        doctor: standardDoctor,
        startTime: new Date(`${MONDAY}T16:30:00Z`),
        endTime: new Date(`${MONDAY}T17:00:00Z`),
        timezone: 'UTC',
      });
      expect(res.valid).toBe(true);
    });

    it('REJECTS booking on closed days (Saturday)', () => {
      const res = validateDoctorAvailability({
        doctor: standardDoctor,
        startTime: new Date(`${SATURDAY}T10:00:00Z`),
        endTime: new Date(`${SATURDAY}T10:30:00Z`),
        timezone: 'UTC',
      });
      expect(res.valid).toBe(false);
      expect(res.errorCode).toBe('DOCTOR_SCHEDULE_CLOSED');
    });
  });

  describe('Doctor Leaves Enforcement', () => {
    it('REJECTS booking on a date when doctor is on leave (2026-12-25)', () => {
      const res = validateDoctorAvailability({
        doctor: standardDoctor,
        startTime: new Date('2026-12-25T10:00:00Z'),
        endTime: new Date('2026-12-25T10:30:00Z'),
        timezone: 'UTC',
      });
      expect(res.valid).toBe(false);
      expect(res.errorCode).toBe('DOCTOR_ON_LEAVE');
    });
  });

  describe('Multi-Break Support', () => {
    it('REJECTS appointments overlapping any configured break (Morning Tea or Lunch)', () => {
      const multiBreakDoctor = {
        id: 'doc-multi',
        status: 'active',
        workingHours: [
          {
            dayOfWeek: 1,
            openTime: '08:00',
            closeTime: '18:00',
            breaks: [
              { start: '10:30', end: '11:00', label: 'Morning Tea' },
              { start: '13:00', end: '14:00', label: 'Lunch' },
              { start: '16:00', end: '16:15', label: 'Afternoon Break' },
            ],
            isClosed: false,
          },
        ],
      };

      // Overlap Morning Tea
      const res1 = validateDoctorAvailability({
        doctor: multiBreakDoctor,
        startTime: new Date(`${MONDAY}T10:45:00Z`),
        endTime: new Date(`${MONDAY}T11:15:00Z`),
        timezone: 'UTC',
      });
      expect(res1.valid).toBe(false);
      expect(res1.errorCode).toBe('DOCTOR_BREAK_CONFLICT');

      // Overlap Afternoon Break
      const res2 = validateDoctorAvailability({
        doctor: multiBreakDoctor,
        startTime: new Date(`${MONDAY}T16:05:00Z`),
        endTime: new Date(`${MONDAY}T16:35:00Z`),
        timezone: 'UTC',
      });
      expect(res2.valid).toBe(false);
      expect(res2.errorCode).toBe('DOCTOR_BREAK_CONFLICT');

      // Valid slot between breaks
      const res3 = validateDoctorAvailability({
        doctor: multiBreakDoctor,
        startTime: new Date(`${MONDAY}T11:30:00Z`),
        endTime: new Date(`${MONDAY}T12:30:00Z`),
        timezone: 'UTC',
      });
      expect(res3.valid).toBe(true);
    });
  });

  describe('Existing Appointment Overlap Check', () => {
    const existing = [
      {
        id: 'existing-1',
        startTime: new Date(`${MONDAY}T09:30:00Z`),
        endTime: new Date(`${MONDAY}T10:00:00Z`),
        status: 'scheduled',
      },
    ];

    it('REJECTS booking that overlaps existing active appointment', () => {
      const res = validateDoctorAvailability({
        doctor: standardDoctor,
        startTime: new Date(`${MONDAY}T09:45:00Z`),
        endTime: new Date(`${MONDAY}T10:15:00Z`),
        timezone: 'UTC',
        existingAppointments: existing,
      });
      expect(res.valid).toBe(false);
      expect(res.errorCode).toBe('APPOINTMENT_CONFLICT');
    });

    it('ALLOWS rescheduling to the same slot when excludeAppointmentId is provided', () => {
      const res = validateDoctorAvailability({
        doctor: standardDoctor,
        startTime: new Date(`${MONDAY}T09:30:00Z`),
        endTime: new Date(`${MONDAY}T10:00:00Z`),
        timezone: 'UTC',
        existingAppointments: existing,
        excludeAppointmentId: 'existing-1',
      });
      expect(res.valid).toBe(true);
    });
  });

  describe('Deterministic Weekday Mapping & Timezone Safety', () => {
    it('correctly maps every weekday without timezone corruption', () => {
      // 2026-09-06 = Sunday (0)
      expect(dateStringToDayOfWeek('2026-09-06')).toBe(0);
      // 2026-09-07 = Monday (1)
      expect(dateStringToDayOfWeek('2026-09-07')).toBe(1);
      // 2026-09-08 = Tuesday (2)
      expect(dateStringToDayOfWeek('2026-09-08')).toBe(2);
      // 2026-09-09 = Wednesday (3)
      expect(dateStringToDayOfWeek('2026-09-09')).toBe(3);
      // 2026-09-10 = Thursday (4)
      expect(dateStringToDayOfWeek('2026-09-10')).toBe(4);
      // 2026-09-11 = Friday (5)
      expect(dateStringToDayOfWeek('2026-09-11')).toBe(5);
      // 2026-09-12 = Saturday (6)
      expect(dateStringToDayOfWeek('2026-09-12')).toBe(6);
    });
  });

  describe('Doctor Working Hours vs Clinic Hours Precedence', () => {
    const saturdayDoctor = {
      id: 'doc-sat',
      status: 'active',
      workingHours: [
        { dayOfWeek: 1, openTime: '09:00', closeTime: '17:00', breakStart: '12:00', breakEnd: '13:00', isClosed: false },
        { dayOfWeek: 2, openTime: '09:00', closeTime: '17:00', breakStart: '12:00', breakEnd: '13:00', isClosed: false },
        { dayOfWeek: 3, openTime: '09:00', closeTime: '17:00', breakStart: '12:00', breakEnd: '13:00', isClosed: false },
        { dayOfWeek: 4, openTime: '09:00', closeTime: '17:00', breakStart: '12:00', breakEnd: '13:00', isClosed: false },
        { dayOfWeek: 5, openTime: '09:00', closeTime: '17:00', breakStart: '12:00', breakEnd: '13:00', isClosed: false },
        { dayOfWeek: 6, openTime: '09:00', closeTime: '17:00', breakStart: '12:00', breakEnd: '13:00', isClosed: false },
        { dayOfWeek: 0, isClosed: true },
      ],
      leaves: [],
    };

    const clinicWithSaturdayClosed = [
      { dayOfWeek: 0, openTime: '09:00', closeTime: '17:00', isClosed: true },
      { dayOfWeek: 1, openTime: '09:00', closeTime: '17:00', isClosed: false },
      { dayOfWeek: 2, openTime: '09:00', closeTime: '17:00', isClosed: false },
      { dayOfWeek: 3, openTime: '09:00', closeTime: '17:00', isClosed: false },
      { dayOfWeek: 4, openTime: '09:00', closeTime: '17:00', isClosed: false },
      { dayOfWeek: 5, openTime: '09:00', closeTime: '17:00', isClosed: false },
      { dayOfWeek: 6, openTime: '09:00', closeTime: '14:00', isClosed: true }, // Clinic is CLOSED on Saturday
    ];

    it('ALLOWS Saturday booking when doctor is open even if clinic is closed on Saturday', () => {
      const schedule = getEffectiveDoctorSchedule({
        doctor: saturdayDoctor,
        date: '2026-09-12', // Saturday
        clinicBusinessHours: clinicWithSaturdayClosed,
      });

      expect(schedule.isOpen).toBe(true);
      expect(schedule.status).toBe('OPEN');
      expect(schedule.scheduleSource).toBe('doctor');
      expect(schedule.workingHours.start).toBe('09:00');
      expect(schedule.workingHours.end).toBe('17:00');
      expect(schedule.workingHours.breakStart).toBe('12:00');
      expect(schedule.workingHours.breakEnd).toBe('13:00');

      // Validate booking
      const res = validateDoctorAvailability({
        doctor: saturdayDoctor,
        startTime: new Date('2026-09-12T10:00:00Z'),
        endTime: new Date('2026-09-12T10:30:00Z'),
        timezone: 'UTC',
        clinicBusinessHours: clinicWithSaturdayClosed,
      });
      expect(res.valid).toBe(true);
    });

    it('REJECTS Saturday booking for a doctor configured as CLOSED even if clinic is open', () => {
      const clinicWithSaturdayOpen = [
        { dayOfWeek: 6, openTime: '09:00', closeTime: '18:00', isClosed: false },
      ];

      const schedule = getEffectiveDoctorSchedule({
        doctor: standardDoctor, // Saturday isClosed: true
        date: '2026-09-12',
        clinicBusinessHours: clinicWithSaturdayOpen,
      });

      expect(schedule.isOpen).toBe(false);
      expect(schedule.status).toBe('DOCTOR_SCHEDULE_CLOSED');
      expect(schedule.reasonCode).toBe('DOCTOR_SCHEDULE_CLOSED');

      const res = validateDoctorAvailability({
        doctor: standardDoctor,
        startTime: new Date('2026-09-12T10:00:00Z'),
        endTime: new Date('2026-09-12T10:30:00Z'),
        timezone: 'UTC',
        clinicBusinessHours: clinicWithSaturdayOpen,
      });
      expect(res.valid).toBe(false);
      expect(res.errorCode).toBe('DOCTOR_SCHEDULE_CLOSED');
    });

    it('calculates availability independently for Doctor A (closed) and Doctor B (open) on the same date', () => {
      const scheduleA = getEffectiveDoctorSchedule({
        doctor: standardDoctor, // Closed Saturday
        date: '2026-09-12',
      });
      const scheduleB = getEffectiveDoctorSchedule({
        doctor: saturdayDoctor, // Open Saturday
        date: '2026-09-12',
      });

      expect(scheduleA.isOpen).toBe(false);
      expect(scheduleB.isOpen).toBe(true);
    });

    it('falls back to clinic business hours when doctor has NO workingHours configured', () => {
      const unconfiguredDoctor = {
        id: 'doc-none',
        status: 'active',
        workingHours: [],
        leaves: [],
      };

      const scheduleSat = getEffectiveDoctorSchedule({
        doctor: unconfiguredDoctor,
        date: '2026-09-12', // Saturday
        clinicBusinessHours: clinicWithSaturdayClosed, // Saturday closed
      });
      expect(scheduleSat.isOpen).toBe(false);
      expect(scheduleSat.status).toBe('CLINIC_CLOSED');
      expect(scheduleSat.scheduleSource).toBe('clinic_default');

      const scheduleMon = getEffectiveDoctorSchedule({
        doctor: unconfiguredDoctor,
        date: '2026-09-07', // Monday
        clinicBusinessHours: clinicWithSaturdayClosed, // Monday open
      });
      expect(scheduleMon.isOpen).toBe(true);
      expect(scheduleMon.status).toBe('OPEN');
      expect(scheduleMon.scheduleSource).toBe('clinic_default');
    });
  });

  describe('Saturday Breaks & Duration Boundary Checks', () => {
    const saturdayDoctor = {
      id: 'doc-sat',
      status: 'active',
      workingHours: [
        { dayOfWeek: 6, openTime: '09:00', closeTime: '17:00', breakStart: '12:00', breakEnd: '13:00', isClosed: false },
      ],
      leaves: [],
    };

    it('ALLOWS 30-min slot before lunch at 11:30 - 12:00', () => {
      const res = validateDoctorAvailability({
        doctor: saturdayDoctor,
        startTime: new Date('2026-09-12T11:30:00Z'),
        endTime: new Date('2026-09-12T12:00:00Z'),
        timezone: 'UTC',
      });
      expect(res.valid).toBe(true);
    });

    it('REJECTS 60-min slot starting at 11:30 (11:30 - 12:30 overlaps 12:00-13:00 lunch)', () => {
      const res = validateDoctorAvailability({
        doctor: saturdayDoctor,
        startTime: new Date('2026-09-12T11:30:00Z'),
        endTime: new Date('2026-09-12T12:30:00Z'),
        timezone: 'UTC',
      });
      expect(res.valid).toBe(false);
      expect(res.errorCode).toBe('DOCTOR_BREAK_CONFLICT');
    });

    it('REJECTS lunch start slot at 12:00 - 12:30', () => {
      const res = validateDoctorAvailability({
        doctor: saturdayDoctor,
        startTime: new Date('2026-09-12T12:00:00Z'),
        endTime: new Date('2026-09-12T12:30:00Z'),
        timezone: 'UTC',
      });
      expect(res.valid).toBe(false);
      expect(res.errorCode).toBe('DOCTOR_BREAK_CONFLICT');
    });

    it('REJECTS lunch second half at 12:30 - 13:00', () => {
      const res = validateDoctorAvailability({
        doctor: saturdayDoctor,
        startTime: new Date('2026-09-12T12:30:00Z'),
        endTime: new Date('2026-09-12T13:00:00Z'),
        timezone: 'UTC',
      });
      expect(res.valid).toBe(false);
      expect(res.errorCode).toBe('DOCTOR_BREAK_CONFLICT');
    });

    it('ALLOWS slot starting immediately after lunch at 13:00 - 13:30', () => {
      const res = validateDoctorAvailability({
        doctor: saturdayDoctor,
        startTime: new Date('2026-09-12T13:00:00Z'),
        endTime: new Date('2026-09-12T13:30:00Z'),
        timezone: 'UTC',
      });
      expect(res.valid).toBe(true);
    });

    it('End-of-day: 16:30 for 30 mins is VALID (ends at 17:00)', () => {
      const res = validateDoctorAvailability({
        doctor: saturdayDoctor,
        startTime: new Date('2026-09-12T16:30:00Z'),
        endTime: new Date('2026-09-12T17:00:00Z'),
        timezone: 'UTC',
      });
      expect(res.valid).toBe(true);
    });

    it('End-of-day: 17:00 for 30 mins is INVALID (outside working hours)', () => {
      const res = validateDoctorAvailability({
        doctor: saturdayDoctor,
        startTime: new Date('2026-09-12T17:00:00Z'),
        endTime: new Date('2026-09-12T17:30:00Z'),
        timezone: 'UTC',
      });
      expect(res.valid).toBe(false);
      expect(res.errorCode).toBe('APPOINTMENT_OUTSIDE_WORKING_HOURS');
    });

    it('End-of-day: 16:00 for 60 mins is VALID (ends at 17:00)', () => {
      const res = validateDoctorAvailability({
        doctor: saturdayDoctor,
        startTime: new Date('2026-09-12T16:00:00Z'),
        endTime: new Date('2026-09-12T17:00:00Z'),
        timezone: 'UTC',
      });
      expect(res.valid).toBe(true);
    });

    it('End-of-day: 16:30 for 60 mins is INVALID (spans past closing at 17:30)', () => {
      const res = validateDoctorAvailability({
        doctor: saturdayDoctor,
        startTime: new Date('2026-09-12T16:30:00Z'),
        endTime: new Date('2026-09-12T17:30:00Z'),
        timezone: 'UTC',
      });
      expect(res.valid).toBe(false);
      expect(res.errorCode).toBe('APPOINTMENT_OUTSIDE_WORKING_HOURS');
    });
  });
});

/**
 * Doctor Working Hours Payload Validator
 */

import { z } from 'zod';

export const DoctorWorkingHourSchema = z
  .preprocess((val: any) => {
    if (typeof val === 'object' && val !== null) {
      const openTime = val.openTime || val.startTime || '09:00';
      const closeTime = val.closeTime || val.endTime || '17:00';
      const breakStart = val.breakStart || '12:00';
      const breakEnd = val.breakEnd || '13:00';
      return {
        ...val,
        openTime,
        closeTime,
        breakStart,
        breakEnd,
      };
    }
    return val;
  }, z.object({
    dayOfWeek: z.number().int().min(0).max(6),
    openTime: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/, 'Must be HH:mm format'),
    closeTime: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/, 'Must be HH:mm format'),
    breakStart: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/, 'Must be HH:mm format').optional().default('12:00'),
    breakEnd: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/, 'Must be HH:mm format').optional().default('13:00'),
    isClosed: z.boolean(),
  }))
  .refine(
    (data: any) => {
      if (data.isClosed) return true;
      const [openH, openM] = data.openTime.split(':').map(Number);
      const [closeH, closeM] = data.closeTime.split(':').map(Number);
      const openMinutes = openH * 60 + openM;
      const closeMinutes = closeH * 60 + closeM;
      return openMinutes < closeMinutes;
    },
    {
      message: 'Opening time must be strictly before closing time',
      path: ['closeTime'],
    },
  );

export const DoctorWorkingHoursListSchema = z.object({
  workingHours: z.array(DoctorWorkingHourSchema),
});

export type DoctorWorkingHoursListDto = z.infer<typeof DoctorWorkingHoursListSchema>;

/**
 * Doctor Working Hours Payload Validator
 */

import { z } from 'zod';

export const DoctorWorkingHourSchema = z
  .object({
    dayOfWeek: z.number().int().min(0).max(6),
    openTime: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/, 'Must be HH:mm format'),
    closeTime: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/, 'Must be HH:mm format'),
    isClosed: z.boolean(),
  })
  .refine(
    (data) => {
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

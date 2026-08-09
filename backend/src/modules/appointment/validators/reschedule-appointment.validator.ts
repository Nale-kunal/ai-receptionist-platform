/**
 * Reschedule Appointment Request Validator
 */

import { z } from 'zod';

export const RescheduleAppointmentSchema = z
  .object({
    startTime: z
      .string({ required_error: 'Start time is required' })
      .datetime({ message: 'startTime must be an ISO 8601 datetime string' }),
    endTime: z
      .string({ required_error: 'End time is required' })
      .datetime({ message: 'endTime must be an ISO 8601 datetime string' }),
    durationMinutes: z.number().int().positive().optional(),
    timezone: z.string().min(1).max(64).optional(),
    notes: z.string().max(2000).nullable().optional(),
  })
  .refine(
    (data) => new Date(data.endTime) > new Date(data.startTime),
    { message: 'endTime must be after startTime', path: ['endTime'] },
  );

export type RescheduleAppointmentDto = z.infer<typeof RescheduleAppointmentSchema>;

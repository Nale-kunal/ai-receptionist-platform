/**
 * Update Appointment Request Validator
 *
 * Only allows updating the notes field (notes/details update).
 * Status transitions, rescheduling, and cancellation have dedicated endpoints.
 */

import { z } from 'zod';

export const UpdateAppointmentSchema = z.object({
  notes: z.string().max(2000).nullable().optional(),
});

export type UpdateAppointmentDto = z.infer<typeof UpdateAppointmentSchema>;

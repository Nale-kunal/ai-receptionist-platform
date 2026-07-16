/**
 * Cancel Appointment Request Validator
 */

import { z } from 'zod';

export const CancelAppointmentSchema = z.object({
  cancellationReason: z.string().max(500).nullable().optional(),
});

export type CancelAppointmentDto = z.infer<typeof CancelAppointmentSchema>;

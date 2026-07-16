/**
 * List Appointments Query Validator
 */

import { z } from 'zod';
import { APPOINTMENT_STATUSES, APPOINTMENT_SOURCES } from '../constants/appointment.constants';

export const ListAppointmentsSchema = z.object({
  clinicId:  z.string().uuid().optional(),
  doctorId:  z.string().uuid().optional(),
  patientId: z.string().uuid().optional(),
  publicId:  z.string().optional(),
  status:    z.enum(APPOINTMENT_STATUSES).optional(),
  source:    z.enum(APPOINTMENT_SOURCES).optional(),
  startFrom: z.string().datetime().optional(),
  startTo:   z.string().datetime().optional(),
  limit:     z.coerce.number().int().min(1).max(100).default(20),
  offset:    z.coerce.number().int().min(0).default(0),
});

export type ListAppointmentsDto = z.infer<typeof ListAppointmentsSchema>;

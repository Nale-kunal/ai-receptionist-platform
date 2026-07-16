/**
 * Create Appointment Request Validator
 */

import { z } from 'zod';
import {
  APPOINTMENT_SOURCES,
  APPOINTMENT_SOURCE_DASHBOARD,
} from '../constants/appointment.constants';

export const CreateAppointmentSchema = z
  .object({
    clinicId: z.string().uuid('Clinic ID must be a valid UUID'),
    doctorId: z.string().uuid('Doctor ID must be a valid UUID'),
    patientId: z.string().uuid('Patient ID must be a valid UUID'),
    startTime: z
      .string({ required_error: 'Start time is required' })
      .datetime({ message: 'startTime must be an ISO 8601 datetime string' }),
    endTime: z
      .string({ required_error: 'End time is required' })
      .datetime({ message: 'endTime must be an ISO 8601 datetime string' }),
    timezone: z.string().min(1).max(64).default('UTC'),
    source: z.enum(APPOINTMENT_SOURCES).default(APPOINTMENT_SOURCE_DASHBOARD),
    notes: z.string().max(2000).nullable().optional(),
  })
  .refine(
    (data) => new Date(data.endTime) > new Date(data.startTime),
    { message: 'endTime must be after startTime', path: ['endTime'] },
  );

export type CreateAppointmentDto = z.infer<typeof CreateAppointmentSchema>;

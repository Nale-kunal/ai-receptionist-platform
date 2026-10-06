import { z } from 'zod';
import {
  APPOINTMENT_SOURCES,
  APPOINTMENT_SOURCE_DASHBOARD,
  ALL_ALLOWED_APPOINTMENT_REASONS,
  APPOINTMENT_REASON_OTHER,
  REASON_ALIAS_MAP,
} from '../constants/appointment.constants';

const BaseCreateAppointmentSchema = z
  .object({
    clinicId: z.string().uuid('Clinic ID must be a valid UUID').optional(),
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
    appointmentType: z
      .string()
      .min(1, 'Appointment reason cannot be empty')
      .transform((val) => val.toLowerCase().trim())
      .default('routine_checkup'),
    reason: z
      .string()
      .min(1)
      .transform((val) => val.toLowerCase().trim())
      .optional(),
    otherReason: z.string().max(500, 'Other reason cannot exceed 500 characters').optional(),
    reasonDetails: z.string().max(500, 'Reason details cannot exceed 500 characters').optional(),
    durationMinutes: z.number().int().positive().optional(),
    notes: z.string().max(2000).nullable().optional(),
  })
  .refine(
    (data: any) => new Date(data.endTime) > new Date(data.startTime),
    { message: 'endTime must be after startTime', path: ['endTime'] },
  )
  .refine(
    (data: any) => {
      const reasonCode = (data.appointmentType || '').toLowerCase().trim();
      return (ALL_ALLOWED_APPOINTMENT_REASONS as readonly string[]).includes(reasonCode);
    },
    { message: 'Invalid appointment reason code', path: ['appointmentType'] },
  )
  .refine(
    (data: any) => {
      const reasonCode = (data.appointmentType || '').toLowerCase().trim();
      if (reasonCode === APPOINTMENT_REASON_OTHER) {
        const custom = (data.otherReason || data.reasonDetails || '').trim();
        return custom.length > 0;
      }
      return true;
    },
    {
      message: 'Please specify the reason when selecting "Other".',
      path: ['otherReason'],
    },
  );

export const CreateAppointmentSchema = z.preprocess((data: any) => {
  if (data && typeof data === 'object') {
    const copy = { ...data };
    // Allow 'reason' as an alias for 'appointmentType'
    if (!copy.appointmentType && copy.reason) {
      copy.appointmentType = copy.reason;
    }
    // Normalize legacy aliases (e.g. checkup -> routine_checkup)
    if (copy.appointmentType) {
      const normalizedKey = String(copy.appointmentType).toLowerCase().trim();
      if (REASON_ALIAS_MAP[normalizedKey]) {
        copy.appointmentType = REASON_ALIAS_MAP[normalizedKey];
      }
    }
    // Allow 'reasonDetails' as an alias for 'otherReason'
    if (!copy.otherReason && copy.reasonDetails) {
      copy.otherReason = copy.reasonDetails;
    }
    return copy;
  }
  return data;
}, BaseCreateAppointmentSchema);

export type CreateAppointmentDto = z.infer<typeof BaseCreateAppointmentSchema>;

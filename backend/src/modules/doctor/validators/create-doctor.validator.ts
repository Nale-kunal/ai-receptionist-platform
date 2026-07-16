/**
 * Create Doctor Payload Validator
 */

import { z } from 'zod';
import { DoctorWorkingHourSchema } from './working-hours.validator';
import { DoctorLeaveSchema } from './leaves.validator';

export const CreateDoctorSchema = z.object({
  clinicId: z.string().uuid('Clinic ID must be a valid UUID'),
  fullName: z.string().min(1, 'Full name is required').max(100),
  displayName: z.string().min(1, 'Display name is required').max(50),
  specialization: z.string().min(1, 'Specialization is required').max(100),
  licenseNumber: z.string().max(100).nullable().optional(),
  biography: z.string().max(1000).nullable().optional(),
  email: z.string().email('Invalid email format').nullable().optional(),
  phone: z
    .string()
    .regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number format')
    .nullable()
    .optional(),
  profilePhoto: z.string().url('Invalid profile photo URL').or(z.string().length(0)).nullable().optional(),
  
  workingHours: z.array(DoctorWorkingHourSchema).optional(),
  leaves: z.array(DoctorLeaveSchema).optional(),
});

export type CreateDoctorDto = z.infer<typeof CreateDoctorSchema>;

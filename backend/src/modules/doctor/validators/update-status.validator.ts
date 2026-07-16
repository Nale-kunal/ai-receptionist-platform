/**
 * Doctor Status Update Validator
 */

import { z } from 'zod';
import {
  DOCTOR_STATUS_ACTIVE,
  DOCTOR_STATUS_INACTIVE,
  DOCTOR_STATUS_UNAVAILABLE,
  DOCTOR_STATUS_ARCHIVED,
} from '../constants/doctor.constants';

export const UpdateDoctorStatusSchema = z.object({
  status: z.enum([
    DOCTOR_STATUS_ACTIVE,
    DOCTOR_STATUS_INACTIVE,
    DOCTOR_STATUS_UNAVAILABLE,
    DOCTOR_STATUS_ARCHIVED,
  ]),
});

export type UpdateDoctorStatusDto = z.infer<typeof UpdateDoctorStatusSchema>;

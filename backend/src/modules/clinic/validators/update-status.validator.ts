/**
 * Clinic Status Update Validator
 */

import { z } from 'zod';
import {
  CLINIC_STATUS_PENDING_SETUP,
  CLINIC_STATUS_ACTIVE,
  CLINIC_STATUS_SUSPENDED,
  CLINIC_STATUS_ARCHIVED,
} from '../constants/clinic.constants';

export const UpdateClinicStatusSchema = z.object({
  status: z.enum([
    CLINIC_STATUS_PENDING_SETUP,
    CLINIC_STATUS_ACTIVE,
    CLINIC_STATUS_SUSPENDED,
    CLINIC_STATUS_ARCHIVED,
  ]),
});

export type UpdateClinicStatusDto = z.infer<typeof UpdateClinicStatusSchema>;

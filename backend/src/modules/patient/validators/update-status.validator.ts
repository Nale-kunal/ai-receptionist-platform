/**
 * Patient Status Update Validator
 */

import { z } from 'zod';
import {
  PATIENT_STATUS_ACTIVE,
  PATIENT_STATUS_INACTIVE,
  PATIENT_STATUS_BLOCKED,
  PATIENT_STATUS_ARCHIVED,
} from '../constants/patient.constants';

export const UpdatePatientStatusSchema = z.object({
  status: z.enum([
    PATIENT_STATUS_ACTIVE,
    PATIENT_STATUS_INACTIVE,
    PATIENT_STATUS_BLOCKED,
    PATIENT_STATUS_ARCHIVED,
  ]),
});

export type UpdatePatientStatusDto = z.infer<typeof UpdatePatientStatusSchema>;

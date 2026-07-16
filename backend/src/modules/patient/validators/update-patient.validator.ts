/**
 * Update Patient Payload Validator
 */

import { z } from 'zod';
import { CreatePatientSchema } from './create-patient.validator';

export const UpdatePatientSchema = CreatePatientSchema.partial().refine(
  (data) => {
    // Ensure at least one update property is defined
    return Object.keys(data).length > 0;
  },
  {
    message: 'At least one field must be provided for update.',
  },
);

export type UpdatePatientDto = z.infer<typeof UpdatePatientSchema>;

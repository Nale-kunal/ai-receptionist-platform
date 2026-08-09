/**
 * Update Patient Payload Validator
 */

import { z } from 'zod';
import { RawCreatePatientSchema } from './create-patient.validator';

export const UpdatePatientSchema = RawCreatePatientSchema.partial().refine(
  (data: Record<string, unknown>) => {
    // Ensure at least one update property is defined
    return Object.keys(data).length > 0;
  },
  {
    message: 'At least one field must be provided for update.',
  },
);

export type UpdatePatientDto = z.infer<typeof UpdatePatientSchema>;

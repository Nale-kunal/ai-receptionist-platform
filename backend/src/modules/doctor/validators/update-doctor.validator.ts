/**
 * Update Doctor Payload Validator
 */

import { z } from 'zod';
import { CreateDoctorSchema } from './create-doctor.validator';

export const UpdateDoctorSchema = CreateDoctorSchema.omit({
  workingHours: true,
  leaves: true,
})
  .partial()
  .refine(
    (data) => {
      // Ensure at least one update property is defined
      return Object.keys(data).length > 0;
    },
    {
      message: 'At least one field must be provided for update.',
    },
  );

export type UpdateDoctorDto = z.infer<typeof UpdateDoctorSchema>;

/**
 * Update Clinic Payload Validator
 */

import { z } from 'zod';
import { CreateClinicSchema } from './create-clinic.validator';

export const UpdateClinicSchema = CreateClinicSchema.omit({
  ownerId: true,
  slug: true,
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

export type UpdateClinicDto = z.infer<typeof UpdateClinicSchema>;

/**
 * Update Role Validator
 */

import { z } from 'zod';

export const UpdateRoleSchema = z
  .object({
    displayName: z
      .string()
      .trim()
      .min(1, 'Display name must not be empty.')
      .max(128, 'Display name must not exceed 128 characters.')
      .optional(),

    description: z
      .string()
      .trim()
      .max(500, 'Description must not exceed 500 characters.')
      .optional(),

    isActive: z.boolean().optional(),
  })
  .refine(
    (data) => Object.values(data).some((v) => v !== undefined),
    { message: 'At least one field must be provided for update.' },
  );

export type UpdateRoleDTO = z.infer<typeof UpdateRoleSchema>;

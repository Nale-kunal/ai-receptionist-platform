/**
 * Assign Role Validator
 */

import { z } from 'zod';

export const AssignRoleSchema = z.object({
  userId: z
    .string({ required_error: 'User ID is required.' })
    .uuid('User ID must be a valid UUID.'),

  roleId: z
    .string({ required_error: 'Role ID is required.' })
    .uuid('Role ID must be a valid UUID.'),

  clinicId: z
    .string()
    .uuid('Clinic ID must be a valid UUID.')
    .optional()
    .nullable(),

  expiresAt: z
    .string()
    .datetime({ message: 'expiresAt must be a valid ISO 8601 datetime string.' })
    .optional()
    .transform((s) => (s ? new Date(s) : undefined)),
});

export type AssignRoleDTO = z.infer<typeof AssignRoleSchema>;

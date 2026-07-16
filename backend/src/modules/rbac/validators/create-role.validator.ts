/**
 * Create Role Validator
 */

import { z } from 'zod';

export const CreateRoleSchema = z.object({
  name: z
    .string({ required_error: 'Role name is required.' })
    .trim()
    .min(1, 'Role name is required.')
    .max(64, 'Role name must not exceed 64 characters.')
    // kebab-case or snake_case: letters, digits, hyphens, underscores
    .regex(/^[a-z][a-z0-9_-]*$/, 'Role name must start with a lowercase letter and contain only lowercase letters, digits, hyphens, or underscores.'),

  displayName: z
    .string({ required_error: 'Display name is required.' })
    .trim()
    .min(1, 'Display name is required.')
    .max(128, 'Display name must not exceed 128 characters.'),

  description: z
    .string()
    .trim()
    .max(500, 'Description must not exceed 500 characters.')
    .optional(),
});

export type CreateRoleDTO = z.infer<typeof CreateRoleSchema>;

/**
 * Create Permission Validator
 */

import { z } from 'zod';

const PERMISSION_NAME_REGEX = /^[a-z][a-z0-9_-]*(\.[a-z][a-z0-9_-]*)+$/;

export const CreatePermissionSchema = z.object({
  name: z
    .string({ required_error: 'Permission name is required.' })
    .trim()
    .min(3, 'Permission name is too short.')
    .max(128, 'Permission name must not exceed 128 characters.')
    .regex(
      PERMISSION_NAME_REGEX,
      'Permission name must follow the format "resource.action" (e.g. "appointment.create").',
    ),

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

export type CreatePermissionDTO = z.infer<typeof CreatePermissionSchema>;

/**
 * Assign Permission Validator
 * (Grant/Revoke a permission on a role)
 */

import { z } from 'zod';

export const AssignPermissionSchema = z.object({
  permissionId: z
    .string({ required_error: 'Permission ID is required.' })
    .uuid('Permission ID must be a valid UUID.'),
});

export type AssignPermissionDTO = z.infer<typeof AssignPermissionSchema>;

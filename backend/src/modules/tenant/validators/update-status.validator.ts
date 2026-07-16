/**
 * Update Tenant Status Validator Schema
 */

import { z } from 'zod';
import {
  TENANT_STATUS_ACTIVE,
  TENANT_STATUS_SUSPENDED,
  TENANT_STATUS_ARCHIVED,
} from '../constants/tenant.constants';

export const UpdateTenantStatusSchema = z.object({
  status: z.enum([
    TENANT_STATUS_ACTIVE,
    TENANT_STATUS_SUSPENDED,
    TENANT_STATUS_ARCHIVED,
  ], {
    invalid_type_error: 'Invalid tenant status. Allowed: active, suspended, archived.',
  }),
});

export type UpdateTenantStatusDTO = z.infer<typeof UpdateTenantStatusSchema>;

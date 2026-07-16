/**
 * Rollback Configuration Payload Validator
 */

import { z } from 'zod';

export const RollbackConfigurationSchema = z.object({
  changeSummary: z.string().max(255).optional(),
});

export type RollbackConfigurationDto = z.infer<typeof RollbackConfigurationSchema>;

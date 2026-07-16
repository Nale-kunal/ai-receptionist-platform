/**
 * Update Summary Validator
 */

import { z } from 'zod';

export const UpdateSummarySchema = z.object({
  summary: z.object({
    text:                 z.string().min(1).max(8_000),
    primaryIntent:        z.string().max(256).nullable().optional(),
    outcome:              z.string().max(512).nullable().optional(),
    recommendedFollowUp:  z.string().max(512).nullable().optional(),
    actionItems:          z.array(z.string().max(256)).max(20).optional(),
    generatedAt:          z.string().datetime({ message: 'generatedAt must be an ISO 8601 datetime' }),
    generatedByModel:     z.string().max(128).nullable().optional(),
  }),
});

export type UpdateSummaryDto = z.infer<typeof UpdateSummarySchema>;

/**
 * Update Transcript Validator
 *
 * Replaces/appends the full transcript array.
 * Max 500 turns, each message max 10 000 chars.
 */

import { z } from 'zod';
import { SPEAKERS } from '../constants/conversation.constants';

export const TranscriptTurnSchema = z.object({
  sequence:   z.number().int().min(0),
  speaker:    z.enum(SPEAKERS),
  message:    z.string().min(1).max(10_000),
  timestamp:  z.string().datetime({ message: 'timestamp must be an ISO 8601 datetime' }),
  language:   z.string().min(2).max(10).optional(),
  confidence: z.number().min(0).max(1).nullable().optional(),
});

export const UpdateTranscriptSchema = z.object({
  turns: z
    .array(TranscriptTurnSchema)
    .min(1, 'At least one transcript turn is required')
    .max(500, 'Maximum 500 transcript turns per update'),
});

export type UpdateTranscriptDto = z.infer<typeof UpdateTranscriptSchema>;

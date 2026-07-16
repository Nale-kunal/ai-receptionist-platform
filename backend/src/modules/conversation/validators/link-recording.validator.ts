/**
 * Link Recording Validator
 */

import { z } from 'zod';
import { RECORDING_STATUSES } from '../constants/conversation.constants';

export const LinkRecordingSchema = z.object({
  recordingReference: z
    .string()
    .min(1, 'Recording reference is required')
    .max(1024, 'Recording reference must not exceed 1024 characters'),
  recordingProvider: z.string().min(1).max(128),
  recordingStatus:   z.enum(RECORDING_STATUSES),
});

export type LinkRecordingDto = z.infer<typeof LinkRecordingSchema>;

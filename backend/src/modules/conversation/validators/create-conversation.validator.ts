/**
 * Create Conversation Validator
 */

import { z } from 'zod';

export const CreateConversationSchema = z.object({
  clinicId:      z.string().uuid('Clinic ID must be a valid UUID'),
  patientId:     z.string().uuid().nullable().optional(),
  doctorId:      z.string().uuid().nullable().optional(),
  appointmentId: z.string().uuid().nullable().optional(),
  callSessionId: z.string().min(1, 'Call session ID is required').max(256),
  callerPhone:   z.string().max(32).nullable().optional(),
  startedAt:     z.string().datetime({ message: 'startedAt must be an ISO 8601 datetime' }),
  language:      z.string().min(2).max(10).default('en'),
  metadata:      z.record(z.unknown()).nullable().optional(),
});

export type CreateConversationDto = z.infer<typeof CreateConversationSchema>;

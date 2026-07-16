/**
 * List Conversations Query Validator
 */

import { z } from 'zod';
import { CONVERSATION_STATUSES } from '../constants/conversation.constants';

export const ListConversationsSchema = z.object({
  clinicId:      z.string().uuid().optional(),
  patientId:     z.string().uuid().optional(),
  doctorId:      z.string().uuid().optional(),
  appointmentId: z.string().uuid().optional(),
  publicId:      z.string().optional(),
  callSessionId: z.string().optional(),
  status:        z.enum(CONVERSATION_STATUSES).optional(),
  intent:        z.string().max(256).optional(),
  language:      z.string().max(10).optional(),
  startedFrom:   z.string().datetime().optional(),
  startedTo:     z.string().datetime().optional(),
  limit:         z.coerce.number().int().min(1).max(100).default(20),
  offset:        z.coerce.number().int().min(0).default(0),
});

export type ListConversationsDto = z.infer<typeof ListConversationsSchema>;

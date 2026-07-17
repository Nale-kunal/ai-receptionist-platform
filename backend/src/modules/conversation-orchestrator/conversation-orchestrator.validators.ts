import { z } from 'zod';

export const ConversationSessionCreateSchema = z.object({
  clinicId: z.string().uuid().nullable().or(z.string().length(0).transform(() => null)),
  conversationId: z.string().uuid(),
  metadata: z.record(z.unknown()).default({}),
});

export const ConversationContextSyncSchema = z.object({
  patientId: z.string().uuid().nullable().optional(),
  doctorId: z.string().uuid().nullable().optional(),
  appointmentId: z.string().uuid().nullable().optional(),
  aiSessionId: z.string().min(1).nullable().optional(),
  promptVersion: z.number().int().min(1).nullable().optional(),
  variables: z.record(z.string()).optional(),
  providerMetadata: z.record(z.unknown()).optional(),
});

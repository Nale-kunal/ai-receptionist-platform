import { z } from 'zod';
import { SUPPORTED_REALTIME_PROVIDERS } from '../constants/realtime-ai.constants';

export const RealtimeSessionCreateSchema = z.object({
  clinicId: z.string().uuid().nullable().or(z.string().length(0).transform(() => null)),
  conversationId: z.string().uuid(),
  provider: z.enum(SUPPORTED_REALTIME_PROVIDERS),
  providerSessionId: z.string().min(1, 'Provider session ID is required.'),
  metadata: z.record(z.unknown()).default({}),
});

export const RealtimeSessionUpdateSchema = z.object({
  model: z.string().optional(),
  voice: z.string().optional(),
  instructions: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
});

/**
 * AI Engine Request Validators
 */

import { z } from 'zod';

export const ChatRequestSchema = z.object({
  clinicId: z.string().uuid().nullable().or(z.string().length(0).transform(() => null)),
  conversationId: z.string().uuid(),
  message: z.string().min(1).max(2000),
});

export const ParseRequestSchema = z.object({
  clinicId: z.string().uuid().nullable().or(z.string().length(0).transform(() => null)),
  message: z.string().min(1).max(2000),
});

export const ListAuditLogsSchema = z.object({
  clinicId: z.string().uuid().optional(),
  conversationId: z.string().uuid().optional(),
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 50))
    .refine((val) => val > 0 && val <= 100, {
      message: 'Limit must be between 1 and 100.',
    }),
  offset: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 0))
    .refine((val) => val >= 0, {
      message: 'Offset must be non-negative.',
    }),
});

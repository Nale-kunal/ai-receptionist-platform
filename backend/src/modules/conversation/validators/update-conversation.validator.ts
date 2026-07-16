/**
 * Update Conversation Validator
 *
 * General metadata/entity update. Status transitions use dedicated endpoints.
 */

import { z } from 'zod';

export const UpdateConversationSchema = z
  .object({
    patientId:         z.string().uuid().nullable().optional(),
    doctorId:          z.string().uuid().nullable().optional(),
    appointmentId:     z.string().uuid().nullable().optional(),
    intent:            z.string().max(256).nullable().optional(),
    sentiment:         z.string().max(64).nullable().optional(),
    extractedEntities: z.record(z.unknown()).nullable().optional(),
    inputTokens:       z.number().int().min(0).nullable().optional(),
    outputTokens:      z.number().int().min(0).nullable().optional(),
    totalTokens:       z.number().int().min(0).nullable().optional(),
    estimatedCostUsd:  z.string().regex(/^\d+(\.\d{1,6})?$/, 'Must be a numeric decimal string').nullable().optional(),
    aiModel:           z.string().max(128).nullable().optional(),
    aiProvider:        z.string().max(128).nullable().optional(),
    metadata:          z.record(z.unknown()).nullable().optional(),
  })
  .refine(
    (data) => Object.values(data).some((v) => v !== undefined),
    { message: 'At least one field must be provided for update.' },
  );

export type UpdateConversationDto = z.infer<typeof UpdateConversationSchema>;

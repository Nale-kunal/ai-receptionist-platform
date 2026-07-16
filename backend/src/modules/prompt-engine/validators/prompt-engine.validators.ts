/**
 * Prompt Engine Request Validators (Zod)
 */

import { z } from 'zod';
import { SUPPORTED_PROMPT_TYPES, SUPPORTED_PROMPT_STATUSES } from '../constants/prompt-engine.constants';

// ---------------------------------------------------------------------------
// Create Prompt
// ---------------------------------------------------------------------------

export const CreatePromptSchema = z.object({
  clinicId: z.string().uuid().nullable().or(z.string().length(0).transform(() => null)),
  promptType: z.enum([...SUPPORTED_PROMPT_TYPES] as [string, ...string[]]),
  content: z.string().min(1, 'Content is required.').max(32_768, 'Content exceeds maximum length.'),
  variables: z.array(z.string()).default([]),
  changeSummary: z.string().max(500).optional(),
});

// ---------------------------------------------------------------------------
// Update Prompt
// ---------------------------------------------------------------------------

export const UpdatePromptSchema = z.object({
  content: z.string().min(1).max(32_768).optional(),
  variables: z.array(z.string()).optional(),
  changeSummary: z.string().max(500).optional(),
}).refine(
  (data) => data.content !== undefined || data.variables !== undefined || data.changeSummary !== undefined,
  { message: 'At least one of content, variables, or changeSummary must be provided.' },
);

// ---------------------------------------------------------------------------
// Rollback Prompt — identifies the target historical version
// ---------------------------------------------------------------------------

export const RollbackPromptSchema = z.object({
  targetVersionId: z.string().uuid('targetVersionId must be a valid UUID.'),
});

// ---------------------------------------------------------------------------
// List Prompts (query params)
// ---------------------------------------------------------------------------

export const ListPromptsSchema = z.object({
  clinicId: z.string().uuid().optional(),
  promptType: z.enum([...SUPPORTED_PROMPT_TYPES] as [string, ...string[]]).optional(),
  status: z.enum([...SUPPORTED_PROMPT_STATUSES] as [string, ...string[]]).optional(),
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 50))
    .refine((val) => val > 0 && val <= 100, { message: 'Limit must be between 1 and 100.' }),
  offset: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 0))
    .refine((val) => val >= 0, { message: 'Offset must be non-negative.' }),
});

// ---------------------------------------------------------------------------
// List Audit Logs (query params)
// ---------------------------------------------------------------------------

export const ListPromptAuditLogsSchema = z.object({
  clinicId: z.string().uuid().optional(),
  promptId: z.string().uuid().optional(),
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 50))
    .refine((val) => val > 0 && val <= 100, { message: 'Limit must be between 1 and 100.' }),
  offset: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 0))
    .refine((val) => val >= 0, { message: 'Offset must be non-negative.' }),
});

// ---------------------------------------------------------------------------
// Compose (body)
// ---------------------------------------------------------------------------

export const ComposeSchema = z.object({
  clinicId: z.string().uuid().nullable().or(z.string().length(0).transform(() => null)),
  variables: z
    .record(z.string().optional())
    .default({}),
  conversationContext: z.string().max(4000).optional(),
});

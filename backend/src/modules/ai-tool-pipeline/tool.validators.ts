import { z } from 'zod';

export const ExecuteToolRequestSchema = z.object({
  toolId: z.string().min(1),
  version: z.string().default('1.0.0'),
  parameters: z.record(z.unknown()).default({}),
});

export const DiscoverToolsQuerySchema = z.object({
  name: z.string().optional(),
  category: z.string().optional(),
  tag: z.string().optional(),
  capability: z.string().optional(),
});

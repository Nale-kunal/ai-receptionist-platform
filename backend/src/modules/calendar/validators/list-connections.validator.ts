/**
 * List Connections Query Validator
 */

import { z } from 'zod';
import { CALENDAR_PROVIDERS, CALENDAR_STATUSES } from '../constants/calendar.constants';

export const ListConnectionsSchema = z.object({
  clinicId: z.string().uuid().optional(),
  doctorId: z.string().uuid().optional(),
  provider: z.enum(CALENDAR_PROVIDERS).optional(),
  status:   z.enum(CALENDAR_STATUSES).optional(),
  limit:    z.coerce.number().int().min(1).max(100).default(20),
  offset:   z.coerce.number().int().min(0).default(0),
});

export type ListConnectionsDto = z.infer<typeof ListConnectionsSchema>;

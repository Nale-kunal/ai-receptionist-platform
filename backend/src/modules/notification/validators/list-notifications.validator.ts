/**
 * List Notifications Query Validator
 */

import { z } from 'zod';
import { NOTIFICATION_CHANNELS, NOTIFICATION_STATUSES, NOTIFICATION_TYPES } from '../constants/notification.constants';

export const ListNotificationsSchema = z.object({
  clinicId:      z.string().uuid().optional(),
  patientId:     z.string().uuid().optional(),
  status:        z.enum(NOTIFICATION_STATUSES).optional(),
  channel:       z.enum(NOTIFICATION_CHANNELS).optional(),
  type:          z.enum(NOTIFICATION_TYPES).optional(),
  scheduledFrom: z.string().datetime().optional(),
  scheduledTo:   z.string().datetime().optional(),
  limit:         z.coerce.number().int().min(1).max(100).default(20),
  offset:        z.coerce.number().int().min(0).default(0),
});

export type ListNotificationsDto = z.infer<typeof ListNotificationsSchema>;

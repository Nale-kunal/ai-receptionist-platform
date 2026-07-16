/**
 * Create Notification Request Validator
 */

import { z } from 'zod';
import { NOTIFICATION_CHANNELS, NOTIFICATION_TYPES } from '../constants/notification.constants';

export const CreateNotificationSchema = z.object({
  clinicId:       z.string().uuid('Clinic ID must be a valid UUID'),
  patientId:      z.string().uuid().nullable().optional(),
  appointmentId:  z.string().uuid().nullable().optional(),
  conversationId: z.string().uuid().nullable().optional(),
  recipient:      z.string().min(1, 'Recipient is required').max(256),
  channel:        z.enum(NOTIFICATION_CHANNELS),
  type:           z.enum(NOTIFICATION_TYPES),
  subject:        z.string().max(256).nullable().optional(),
  templateName:   z.string().min(1, 'Template name is required').max(128),
  variables:      z.record(z.unknown()).optional(),
  scheduledAt:    z.string().datetime({ message: 'scheduledAt must be an ISO 8601 datetime' }).nullable().optional(),
  metadata:       z.record(z.unknown()).optional(),
});

export type CreateNotificationDto = z.infer<typeof CreateNotificationSchema>;

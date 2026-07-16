/**
 * Connect Calendar Request Validator
 */

import { z } from 'zod';
import { CALENDAR_PROVIDERS } from '../constants/calendar.constants';

export const ConnectCalendarSchema = z.object({
  clinicId:     z.string().uuid('Clinic ID must be a valid UUID'),
  doctorId:     z.string().uuid().nullable().optional(),
  provider:     z.enum(CALENDAR_PROVIDERS),
  calendarId:   z.string().min(1, 'Calendar ID is required').max(256),
  accessToken:  z.string().min(1, 'Access token is required'),
  refreshToken: z.string().nullable().optional(),
  tokenExpiry:  z.string().datetime({ message: 'tokenExpiry must be an ISO 8601 datetime' }).nullable().optional(),
});

export type ConnectCalendarDto = z.infer<typeof ConnectCalendarSchema>;

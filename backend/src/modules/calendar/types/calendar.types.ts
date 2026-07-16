/**
 * Calendar Module Types
 */

import type { CalendarProvider, CalendarConnectionStatus } from '../constants/calendar.constants';

export interface SafeCalendarConnection {
  id: string;
  publicId: string;
  tenantId: string;
  clinicId: string;
  doctorId: string | null;

  provider: CalendarProvider;
  calendarId: string | null;
  connectionStatus: CalendarConnectionStatus;
  lastSyncTime: Date | null;

  // Credential metadata only (never plain credentials)
  tokenExpiry: Date | null;
  hasRefreshToken: boolean;

  createdAt: Date;
  updatedAt: Date;
}

export interface CalendarEventMappingDto {
  id: string;
  calendarConnectionId: string;
  appointmentId: string;
  externalEventId: string;
  createdAt: Date;
}

export interface SyncResult {
  success: boolean;
  externalEventId?: string;
  error?: string;
}

export interface AvailabilitySlot {
  startTime: string; // ISO-8601
  endTime: string;   // ISO-8601
}

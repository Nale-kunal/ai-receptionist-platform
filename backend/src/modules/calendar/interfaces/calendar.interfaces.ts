/**
 * Calendar Module Interfaces
 */

import type { CalendarProvider, CalendarConnectionStatus } from '../constants/calendar.constants';
import type { SafeCalendarConnection, SyncResult, AvailabilitySlot } from '../types/calendar.types';

// ---------------------------------------------------------------------------
// Provider Interface
// ---------------------------------------------------------------------------

export interface ICalendarProvider {
  createEvent(
    connection: { accessToken: string; refreshToken?: string | null; calendarId?: string | null },
    appointment: { startTime: Date; endTime: Date; timezone: string; notes?: string | null; patientName: string },
  ): Promise<SyncResult>;

  updateEvent(
    connection: { accessToken: string; refreshToken?: string | null; calendarId?: string | null },
    externalEventId: string,
    appointment: { startTime: Date; endTime: Date; timezone: string; notes?: string | null; patientName: string },
  ): Promise<SyncResult>;

  deleteEvent(
    connection: { accessToken: string; refreshToken?: string | null; calendarId?: string | null },
    externalEventId: string,
  ): Promise<SyncResult>;

  getAvailability(
    connection: { accessToken: string; refreshToken?: string | null; calendarId?: string | null },
    startTime: Date,
    endTime: Date,
  ): Promise<AvailabilitySlot[]>;

  getProviderName(): CalendarProvider;
}

// ---------------------------------------------------------------------------
// Service Param Interfaces
// ---------------------------------------------------------------------------

export interface ConnectCalendarParams {
  tenantId: string;
  clinicId: string;
  doctorId?: string | null;
  provider: CalendarProvider;
  calendarId: string;
  accessToken: string;
  refreshToken?: string | null;
  tokenExpiry?: Date | null;

  actorId: string;
  requestId: string;
}

export interface ListConnectionsParams {
  tenantId: string;
  clinicId?: string;
  doctorId?: string;
  provider?: CalendarProvider;
  status?: CalendarConnectionStatus;
  limit?: number;
  offset?: number;
}

// ---------------------------------------------------------------------------
// Service Interface
// ---------------------------------------------------------------------------

export interface ICalendarService {
  connectCalendar(params: ConnectCalendarParams): Promise<SafeCalendarConnection>;
  disconnectCalendar(id: string, tenantId: string, actorId: string, requestId: string): Promise<SafeCalendarConnection>;
  getAvailability(id: string, tenantId: string, startTime: Date, endTime: Date): Promise<AvailabilitySlot[]>;

  // Sync methods matching appointment events
  syncAppointmentCreated(appointmentId: string, tenantId: string, actorId: string, requestId: string): Promise<void>;
  syncAppointmentUpdated(appointmentId: string, tenantId: string, actorId: string, requestId: string): Promise<void>;
  syncAppointmentCancelled(appointmentId: string, tenantId: string, actorId: string, requestId: string): Promise<void>;
  syncAppointmentDeleted(appointmentId: string, tenantId: string, actorId: string, requestId: string): Promise<void>;

  processWebhook(provider: CalendarProvider, signature: string, payload: Record<string, unknown>, tenantId: string): Promise<void>;

  getConnectionById(id: string, tenantId: string): Promise<SafeCalendarConnection>;
  getConnectionByPublicId(publicId: string, tenantId: string): Promise<SafeCalendarConnection>;
  listConnections(params: ListConnectionsParams): Promise<SafeCalendarConnection[]>;
}

// ---------------------------------------------------------------------------
// Repository Interface
// ---------------------------------------------------------------------------

export interface ICalendarRepository {
  createConnection(data: {
    tenantId: string;
    clinicId: string;
    doctorId?: string | null;
    provider: CalendarProvider;
    calendarId: string;
    connectionStatus: CalendarConnectionStatus;
    accessToken: string;
    refreshToken?: string | null;
    tokenExpiry?: Date | null;
  }): Promise<unknown>;

  updateConnection(
    id: string,
    data: {
      connectionStatus?: CalendarConnectionStatus;
      lastSyncTime?: Date | null;
      accessToken?: string;
      refreshToken?: string | null;
      tokenExpiry?: Date | null;
      syncToken?: string | null;
      deletedAt?: Date | null;
    },
  ): Promise<unknown>;

  findConnectionById(id: string, includeDeleted?: boolean): Promise<unknown | null>;
  findConnectionByPublicId(publicId: string, includeDeleted?: boolean): Promise<unknown | null>;

  findConnections(params: {
    tenantId: string;
    clinicId?: string;
    doctorId?: string;
    provider?: CalendarProvider;
    status?: CalendarConnectionStatus;
    limit?: number;
    offset?: number;
    includeDeleted?: boolean;
  }): Promise<unknown[]>;

  findActiveConnectionsForClinic(clinicId: string, tenantId: string): Promise<unknown[]>;

  // Event mappings
  createMapping(data: {
    tenantId: string;
    clinicId: string;
    calendarConnectionId: string;
    appointmentId: string;
    externalEventId: string;
  }): Promise<unknown>;

  findMapping(connectionId: string, appointmentId: string): Promise<unknown | null>;
  deleteMapping(connectionId: string, appointmentId: string): Promise<void>;

  // Sync logs
  createSyncLog(data: {
    tenantId: string;
    clinicId: string;
    calendarConnectionId: string;
    direction: 'push' | 'pull';
    status: 'success' | 'failed';
    appointmentId?: string | null;
    details?: string | null;
    errorDetails?: string | null;
  }): Promise<unknown>;

  // Validations
  clinicIsActive(clinicId: string, tenantId: string): Promise<boolean>;
  doctorBelongsToClinic(doctorId: string, clinicId: string, tenantId: string): Promise<boolean>;
  getAppointmentWithPatient(appointmentId: string, tenantId: string): Promise<unknown | null>;
}

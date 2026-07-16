/**
 * Calendar Service
 *
 * Implements Google Calendar connection authentication, encryption, availability check,
 * webhook validation, and event sync with retry logic.
 */

import type {
  ICalendarService,
  ICalendarRepository,
  ConnectCalendarParams,
  ListConnectionsParams,
  ICalendarProvider,
} from '../interfaces/calendar.interfaces';
import type { ICalendarEventPublisher } from '../events/calendar-event.publisher';
import type { SafeCalendarConnection, AvailabilitySlot, SyncResult } from '../types/calendar.types';
import type { CalendarProvider, CalendarConnectionStatus } from '../constants/calendar.constants';
import {
  CALENDAR_PROVIDER_GOOGLE,
  CALENDAR_PROVIDER_OUTLOOK,
  CALENDAR_STATUS_PENDING,
  CALENDAR_STATUS_CONNECTED,
  CALENDAR_STATUS_DISCONNECTED,
  CALENDAR_STATUS_EXPIRED,
  CALENDAR_STATUS_ERROR,
  CALENDAR_STATUS_DISABLED,
} from '../constants/calendar.constants';
import {
  CalendarConnectionNotFoundError,
  CalendarIsolationViolationError,
  AvailabilityFetchFailedError,
  WebhookVerificationFailedError,
  ClinicNotActiveForCalendarError,
  CalendarOwnershipError,
} from '../errors/calendar.errors';
import {
  EVENT_CALENDAR_CONNECTED,
  EVENT_CALENDAR_DISCONNECTED,
  EVENT_CALENDAR_SYNC_STARTED,
  EVENT_CALENDAR_SYNC_COMPLETED,
  EVENT_CALENDAR_SYNC_FAILED,
  EVENT_CALENDAR_WEBHOOK_PROCESSED,
  EVENT_CALENDAR_CREDENTIAL_UPDATED,
} from '../events/calendar.events';
import { encryptToken, decryptToken } from '../utils/encryption.utils';

// ---------------------------------------------------------------------------
// Google Calendar Mock Provider Adapter
// ---------------------------------------------------------------------------

export class MockGoogleCalendarAdapter implements ICalendarProvider {
  public async createEvent(
    connection: { accessToken: string; refreshToken?: string | null; calendarId?: string | null },
    appointment: { startTime: Date; endTime: Date; timezone: string; notes?: string | null; patientName: string },
  ): Promise<SyncResult> {
    if (connection.accessToken.includes('fail')) {
      return { success: false, error: 'OAuth token validation failed.' };
    }
    return { success: true, externalEventId: `gcal_event_${Math.random().toString(36).substr(2, 9)}` };
  }

  public async updateEvent(
    connection: { accessToken: string; refreshToken?: string | null; calendarId?: string | null },
    externalEventId: string,
    appointment: { startTime: Date; endTime: Date; timezone: string; notes?: string | null; patientName: string },
  ): Promise<SyncResult> {
    if (connection.accessToken.includes('fail')) {
      return { success: false, error: 'OAuth token validation failed.' };
    }
    return { success: true, externalEventId };
  }

  public async deleteEvent(
    connection: { accessToken: string; refreshToken?: string | null; calendarId?: string | null },
    externalEventId: string,
  ): Promise<SyncResult> {
    if (connection.accessToken.includes('fail')) {
      return { success: false, error: 'OAuth token validation failed.' };
    }
    return { success: true };
  }

  public async getAvailability(
    connection: { accessToken: string; refreshToken?: string | null; calendarId?: string | null },
    startTime: Date,
    endTime: Date,
  ): Promise<AvailabilitySlot[]> {
    if (connection.accessToken.includes('fail')) {
      throw new Error('OAuth token validation failed.');
    }
    // Simulates busy slots
    return [
      {
        startTime: new Date(startTime.getTime() + 60 * 60 * 1000).toISOString(),
        endTime: new Date(startTime.getTime() + 2 * 60 * 60 * 1000).toISOString(),
      },
    ];
  }

  public getProviderName(): CalendarProvider {
    return 'google';
  }
}

// ---------------------------------------------------------------------------
// Outlook Calendar Mock Provider Adapter
// ---------------------------------------------------------------------------

export class MockOutlookCalendarAdapter implements ICalendarProvider {
  public async createEvent(
    connection: { accessToken: string; refreshToken?: string | null; calendarId?: string | null },
    appointment: { startTime: Date; endTime: Date; timezone: string; notes?: string | null; patientName: string },
  ): Promise<SyncResult> {
    if (connection.accessToken.includes('fail')) {
      return { success: false, error: 'OAuth token validation failed.' };
    }
    return { success: true, externalEventId: `outlook_event_${Math.random().toString(36).substr(2, 9)}` };
  }

  public async updateEvent(
    connection: { accessToken: string; refreshToken?: string | null; calendarId?: string | null },
    externalEventId: string,
    appointment: { startTime: Date; endTime: Date; timezone: string; notes?: string | null; patientName: string },
  ): Promise<SyncResult> {
    if (connection.accessToken.includes('fail')) {
      return { success: false, error: 'OAuth token validation failed.' };
    }
    return { success: true, externalEventId };
  }

  public async deleteEvent(
    connection: { accessToken: string; refreshToken?: string | null; calendarId?: string | null },
    externalEventId: string,
  ): Promise<SyncResult> {
    if (connection.accessToken.includes('fail')) {
      return { success: false, error: 'OAuth token validation failed.' };
    }
    return { success: true };
  }

  public async getAvailability(
    connection: { accessToken: string; refreshToken?: string | null; calendarId?: string | null },
    startTime: Date,
    endTime: Date,
  ): Promise<AvailabilitySlot[]> {
    if (connection.accessToken.includes('fail')) {
      throw new Error('OAuth token validation failed.');
    }
    return [
      {
        startTime: new Date(startTime.getTime() + 3 * 60 * 60 * 1000).toISOString(),
        endTime: new Date(startTime.getTime() + 4 * 60 * 60 * 1000).toISOString(),
      },
    ];
  }

  public getProviderName(): CalendarProvider {
    return 'outlook';
  }
}

// ---------------------------------------------------------------------------
// Service Config
// ---------------------------------------------------------------------------

export interface CalendarServiceConfig {
  calendarEncryptionSecret: string;
}

// ---------------------------------------------------------------------------
// Service Implementation
// ---------------------------------------------------------------------------

export class CalendarService implements ICalendarService {
  private readonly providers: Record<CalendarProvider, ICalendarProvider>;
  private readonly secretKey: string;

  constructor(
    private readonly repository: ICalendarRepository,
    private readonly publisher: ICalendarEventPublisher,
    config: CalendarServiceConfig,
    customProviders?: Record<CalendarProvider, ICalendarProvider>,
  ) {
    this.secretKey = config.calendarEncryptionSecret;
    this.providers = customProviders ?? {
      google:  new MockGoogleCalendarAdapter(),
      outlook: new MockOutlookCalendarAdapter(),
    };
  }

  // -------------------------------------------------------------------------
  // Connect Calendar
  // -------------------------------------------------------------------------

  public async connectCalendar(params: ConnectCalendarParams): Promise<SafeCalendarConnection> {
    // 1. Clinic is active
    const clinicActive = await this.repository.clinicIsActive(params.clinicId, params.tenantId);
    if (!clinicActive) {
      throw new ClinicNotActiveForCalendarError();
    }

    // 2. Doctor ownership check if doctorId is provided
    if (params.doctorId) {
      const valid = await this.repository.doctorBelongsToClinic(params.doctorId, params.clinicId, params.tenantId);
      if (!valid) {
        throw new CalendarOwnershipError('Doctor');
      }
    }

    // 3. Encrypt credentials
    const encryptedAccess = encryptToken(params.accessToken, this.secretKey);
    const encryptedRefresh = params.refreshToken ? encryptToken(params.refreshToken, this.secretKey) : null;

    // 4. Create database connection entry
    const created = await this.repository.createConnection({
      tenantId:         params.tenantId,
      clinicId:         params.clinicId,
      doctorId:         params.doctorId,
      provider:         params.provider,
      calendarId:       params.calendarId,
      connectionStatus: CALENDAR_STATUS_CONNECTED,
      accessToken:      encryptedAccess,
      refreshToken:     encryptedRefresh,
      tokenExpiry:      params.tokenExpiry,
    });

    const safe = this.toSafe(created);

    // 5. Publish audit event
    await this.publisher.publish({
      type: EVENT_CALENDAR_CONNECTED,
      payload: {
        tenantId:             safe.tenantId,
        clinicId:             safe.clinicId,
        calendarConnectionId: safe.id,
        actorId:              params.actorId,
        requestId:            params.requestId,
        occurredAt:           new Date(),
        provider:             safe.provider,
        calendarId:           safe.calendarId ?? '',
      },
    });

    return safe;
  }

  // -------------------------------------------------------------------------
  // Disconnect Calendar
  // -------------------------------------------------------------------------

  public async disconnectCalendar(
    id: string,
    tenantId: string,
    actorId: string,
    requestId: string,
  ): Promise<SafeCalendarConnection> {
    const existing = await this.requireConnection(id, tenantId);
    if (existing.connectionStatus === CALENDAR_STATUS_DISCONNECTED) {
      return existing;
    }

    const updated = await this.repository.updateConnection(id, {
      connectionStatus: CALENDAR_STATUS_DISCONNECTED,
    });

    const safe = this.toSafe(updated);

    await this.publisher.publish({
      type: EVENT_CALENDAR_DISCONNECTED,
      payload: {
        tenantId:             safe.tenantId,
        clinicId:             safe.clinicId,
        calendarConnectionId: safe.id,
        actorId,
        requestId,
        occurredAt:           new Date(),
      },
    });

    return safe;
  }

  // -------------------------------------------------------------------------
  // Availability Retrieval
  // -------------------------------------------------------------------------

  public async getAvailability(
    id: string,
    tenantId: string,
    startTime: Date,
    endTime: Date,
  ): Promise<AvailabilitySlot[]> {
    const connection = await this.requireConnection(id, tenantId);
    if (connection.connectionStatus !== CALENDAR_STATUS_CONNECTED) {
      throw new AvailabilityFetchFailedError(connection.provider, 'Calendar is not connected.');
    }

    const rawConnection = await this.repository.findConnectionById(id);
    const decrypted = this.getDecryptedCredentials(rawConnection);
    const provider = this.providers[connection.provider];

    try {
      return await provider.getAvailability(decrypted, startTime, endTime);
    } catch (err: any) {
      throw new AvailabilityFetchFailedError(connection.provider, err.message);
    }
  }

  // -------------------------------------------------------------------------
  // Synchronization (Events-driven)
  // -------------------------------------------------------------------------

  public async syncAppointmentCreated(
    appointmentId: string,
    tenantId: string,
    actorId: string,
    requestId: string,
  ): Promise<void> {
    const appt = await this.repository.getAppointmentWithPatient(appointmentId, tenantId);
    if (!appt) return;

    const typedAppt = appt as {
      clinicId: string;
      tenantId: string;
      startTime: Date;
      endTime: Date;
      timezone: string;
      notes: string | null;
      patient: { fullName: string };
    };

    // Find all connected calendars for this clinic
    const connections = await this.repository.findActiveConnectionsForClinic(typedAppt.clinicId, tenantId);

    for (const record of connections) {
      const conn = record as { id: string; provider: CalendarProvider; calendarId: string };
      await this.runSyncWithRetry(async () => {
        const decrypted = this.getDecryptedCredentials(record);
        const provider = this.providers[conn.provider];

        // 1. Create event at external provider
        const syncResult = await provider.createEvent(decrypted, {
          startTime:    typedAppt.startTime,
          endTime:      typedAppt.endTime,
          timezone:     typedAppt.timezone,
          notes:        typedAppt.notes,
          patientName:  typedAppt.patient.fullName,
        });

        if (syncResult.success && syncResult.externalEventId) {
          // 2. Persist event mapping link
          await this.repository.createMapping({
            tenantId,
            clinicId:             typedAppt.clinicId,
            calendarConnectionId: conn.id,
            appointmentId,
            externalEventId:      syncResult.externalEventId,
          });

          // 3. Log success
          await this.repository.createSyncLog({
            tenantId,
            clinicId:             typedAppt.clinicId,
            calendarConnectionId: conn.id,
            direction:            'push',
            status:               'success',
            appointmentId,
            details:              `Event created with ID: ${syncResult.externalEventId}`,
          });

          await this.publisher.publish({
            type: EVENT_CALENDAR_SYNC_COMPLETED,
            payload: {
              tenantId,
              clinicId:             typedAppt.clinicId,
              calendarConnectionId: conn.id,
              actorId,
              requestId,
              occurredAt:           new Date(),
              appointmentId,
              direction:            'push',
            },
          });
        } else {
          throw new Error(syncResult.error ?? 'Unknown creation error');
        }
      }, conn, appointmentId, 'push', tenantId, actorId, requestId);
    }
  }

  public async syncAppointmentUpdated(
    appointmentId: string,
    tenantId: string,
    actorId: string,
    requestId: string,
  ): Promise<void> {
    const appt = await this.repository.getAppointmentWithPatient(appointmentId, tenantId);
    if (!appt) return;

    const typedAppt = appt as {
      clinicId: string;
      tenantId: string;
      startTime: Date;
      endTime: Date;
      timezone: string;
      notes: string | null;
      patient: { fullName: string };
    };

    const connections = await this.repository.findActiveConnectionsForClinic(typedAppt.clinicId, tenantId);

    for (const record of connections) {
      const conn = record as { id: string; provider: CalendarProvider };
      const mapping = await this.repository.findMapping(conn.id, appointmentId);
      if (!mapping) continue; // Event doesn't exist on this calendar connection

      const typedMapping = mapping as { externalEventId: string };

      await this.runSyncWithRetry(async () => {
        const decrypted = this.getDecryptedCredentials(record);
        const provider = this.providers[conn.provider];

        const syncResult = await provider.updateEvent(decrypted, typedMapping.externalEventId, {
          startTime:    typedAppt.startTime,
          endTime:      typedAppt.endTime,
          timezone:     typedAppt.timezone,
          notes:        typedAppt.notes,
          patientName:  typedAppt.patient.fullName,
        });

        if (syncResult.success) {
          await this.repository.createSyncLog({
            tenantId,
            clinicId:             typedAppt.clinicId,
            calendarConnectionId: conn.id,
            direction:            'push',
            status:               'success',
            appointmentId,
            details:              `Event updated.`,
          });

          await this.publisher.publish({
            type: EVENT_CALENDAR_SYNC_COMPLETED,
            payload: {
              tenantId,
              clinicId:             typedAppt.clinicId,
              calendarConnectionId: conn.id,
              actorId,
              requestId,
              occurredAt:           new Date(),
              appointmentId,
              direction:            'push',
            },
          });
        } else {
          throw new Error(syncResult.error ?? 'Unknown update error');
        }
      }, conn, appointmentId, 'push', tenantId, actorId, requestId);
    }
  }

  public async syncAppointmentCancelled(
    appointmentId: string,
    tenantId: string,
    actorId: string,
    requestId: string,
  ): Promise<void> {
    // Treat cancellation as deletion from external calendar for clean sync
    await this.syncAppointmentDeleted(appointmentId, tenantId, actorId, requestId);
  }

  public async syncAppointmentDeleted(
    appointmentId: string,
    tenantId: string,
    actorId: string,
    requestId: string,
  ): Promise<void> {
    const appt = await this.repository.getAppointmentWithPatient(appointmentId, tenantId);
    if (!appt) return;

    const typedAppt = appt as { clinicId: string };
    const connections = await this.repository.findActiveConnectionsForClinic(typedAppt.clinicId, tenantId);

    for (const record of connections) {
      const conn = record as { id: string; provider: CalendarProvider };
      const mapping = await this.repository.findMapping(conn.id, appointmentId);
      if (!mapping) continue;

      const typedMapping = mapping as { externalEventId: string };

      await this.runSyncWithRetry(async () => {
        const decrypted = this.getDecryptedCredentials(record);
        const provider = this.providers[conn.provider];

        const syncResult = await provider.deleteEvent(decrypted, typedMapping.externalEventId);

        if (syncResult.success) {
          await this.repository.deleteMapping(conn.id, appointmentId);

          await this.repository.createSyncLog({
            tenantId,
            clinicId:             typedAppt.clinicId,
            calendarConnectionId: conn.id,
            direction:            'push',
            status:               'success',
            appointmentId,
            details:              `Event deleted.`,
          });

          await this.publisher.publish({
            type: EVENT_CALENDAR_SYNC_COMPLETED,
            payload: {
              tenantId,
              clinicId:             typedAppt.clinicId,
              calendarConnectionId: conn.id,
              actorId,
              requestId,
              occurredAt:           new Date(),
              appointmentId,
              direction:            'push',
            },
          });
        } else {
          throw new Error(syncResult.error ?? 'Unknown deletion error');
        }
      }, conn, appointmentId, 'push', tenantId, actorId, requestId);
    }
  }

  // -------------------------------------------------------------------------
  // Webhooks
  // -------------------------------------------------------------------------

  public async processWebhook(
    provider: CalendarProvider,
    signature: string,
    payload: Record<string, unknown>,
    tenantId: string,
  ): Promise<void> {
    // Simulates webhook verification
    if (signature === 'invalid') {
      throw new WebhookVerificationFailedError();
    }

    await this.publisher.publish({
      type: EVENT_CALENDAR_WEBHOOK_PROCESSED,
      payload: {
        tenantId,
        provider,
        occurredAt: new Date(),
        details:    `Processed webhook signature: ${signature}`,
      },
    });
  }

  // -------------------------------------------------------------------------
  // Connection Reads
  // -------------------------------------------------------------------------

  public async getConnectionById(id: string, tenantId: string): Promise<SafeCalendarConnection> {
    const record = await this.repository.findConnectionById(id);
    if (!record) throw new CalendarConnectionNotFoundError(id);
    const safe = this.toSafe(record);
    if (safe.tenantId !== tenantId) throw new CalendarIsolationViolationError();
    return safe;
  }

  public async getConnectionByPublicId(publicId: string, tenantId: string): Promise<SafeCalendarConnection> {
    const record = await this.repository.findConnectionByPublicId(publicId);
    if (!record) throw new CalendarConnectionNotFoundError();
    const safe = this.toSafe(record);
    if (safe.tenantId !== tenantId) throw new CalendarIsolationViolationError();
    return safe;
  }

  public async listConnections(params: ListConnectionsParams): Promise<SafeCalendarConnection[]> {
    const records = await this.repository.findConnections({
      tenantId: params.tenantId,
      clinicId: params.clinicId,
      doctorId: params.doctorId,
      provider: params.provider,
      status:   params.status,
      limit:    params.limit,
      offset:   params.offset,
    });
    return records.map((r) => this.toSafe(r));
  }

  // -------------------------------------------------------------------------
  // Private Sync & Retry Core Loop
  // -------------------------------------------------------------------------

  private async runSyncWithRetry(
    syncAction: () => Promise<void>,
    conn: { id: string },
    appointmentId: string,
    direction: 'push' | 'pull',
    tenantId: string,
    actorId: string,
    requestId: string,
  ): Promise<void> {
    const maxRetries = 3;
    let attempts = 0;
    let success = false;
    let lastError = '';

    await this.publisher.publish({
      type: EVENT_CALENDAR_SYNC_STARTED,
      payload: {
        tenantId,
        clinicId:             (conn as any).clinicId ?? '',
        calendarConnectionId: conn.id,
        actorId,
        requestId,
        occurredAt:           new Date(),
        appointmentId,
        direction,
      },
    });

    while (attempts < maxRetries && !success) {
      try {
        attempts++;
        await syncAction();
        success = true;
      } catch (err: any) {
        lastError = err.message || 'Unknown provider error';
        console.warn(`Sync attempt ${attempts} failed for connection ${conn.id}: ${lastError}`);
      }
    }

    if (!success) {
      // Create failure log
      await this.repository.createSyncLog({
        tenantId,
        clinicId:             (conn as any).clinicId ?? '',
        calendarConnectionId: conn.id,
        direction,
        status:               'failed',
        appointmentId,
        errorDetails:         `Sync failed after ${maxRetries} attempts: ${lastError}`,
      });

      // Mark connection status to Error status
      await this.repository.updateConnection(conn.id, {
        connectionStatus: CALENDAR_STATUS_ERROR,
      });

      await this.publisher.publish({
        type: EVENT_CALENDAR_SYNC_FAILED,
        payload: {
          tenantId,
          clinicId:             (conn as any).clinicId ?? '',
          calendarConnectionId: conn.id,
          actorId,
          requestId,
          occurredAt:           new Date(),
          appointmentId,
          direction,
          error:                lastError,
        },
      });
    }
  }

  private getDecryptedCredentials(connection: any) {
    const accessToken = decryptToken(connection.accessToken, this.secretKey);
    const refreshToken = connection.refreshToken ? decryptToken(connection.refreshToken, this.secretKey) : null;
    return { accessToken, refreshToken, calendarId: connection.calendarId };
  }

  private async requireConnection(id: string, tenantId: string): Promise<SafeCalendarConnection> {
    const record = await this.repository.findConnectionById(id);
    if (!record) throw new CalendarConnectionNotFoundError(id);
    const safe = this.toSafe(record);
    if (safe.tenantId !== tenantId) throw new CalendarIsolationViolationError();
    return safe;
  }

  private toSafe(record: any): SafeCalendarConnection {
    return {
      id:               record.id,
      publicId:         record.publicId,
      tenantId:         record.tenantId,
      clinicId:         record.clinicId,
      doctorId:         record.doctorId ?? null,
      provider:         record.provider as CalendarProvider,
      calendarId:       record.calendarId ?? null,
      connectionStatus: record.connectionStatus as CalendarConnectionStatus,
      lastSyncTime:     record.lastSyncTime ?? null,
      tokenExpiry:      record.tokenExpiry ?? null,
      hasRefreshToken:  !!record.refreshToken,
      createdAt:        record.createdAt,
      updatedAt:        record.updatedAt,
    };
  }
}

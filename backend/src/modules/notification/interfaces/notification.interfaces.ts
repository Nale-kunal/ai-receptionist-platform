/**
 * Notification Module Interfaces
 */

import type { NotificationChannel, NotificationStatus, NotificationType } from '../constants/notification.constants';
import type { SafeNotification, NotificationPreferences } from '../types/notification.types';

// ---------------------------------------------------------------------------
// Provider Interface
// ---------------------------------------------------------------------------

export interface SendResult {
  success: boolean;
  providerMessageId?: string;
  error?: string;
}

export interface INotificationProvider {
  send(recipient: string, content: string, subject?: string): Promise<SendResult>;
  getProviderName(): string;
}

// ---------------------------------------------------------------------------
// Service Param Interfaces
// ---------------------------------------------------------------------------

export interface CreateNotificationParams {
  tenantId: string;
  clinicId: string;
  patientId?: string | null;
  appointmentId?: string | null;
  conversationId?: string | null;
  recipient: string;
  channel: NotificationChannel;
  type: NotificationType;
  subject?: string | null;
  templateName: string;
  variables?: Record<string, unknown>;
  scheduledAt?: Date | null;
  metadata?: Record<string, unknown>;

  actorId: string;
  requestId: string;
}

export interface ListNotificationsParams {
  tenantId: string;
  clinicId?: string;
  patientId?: string;
  status?: NotificationStatus;
  channel?: NotificationChannel;
  type?: NotificationType;
  scheduledFrom?: Date;
  scheduledTo?: Date;
  limit?: number;
  offset?: number;
}

// ---------------------------------------------------------------------------
// Service Interface
// ---------------------------------------------------------------------------

export interface INotificationService {
  createNotification(params: CreateNotificationParams): Promise<SafeNotification>;
  sendImmediate(id: string, tenantId: string, actorId: string, requestId: string): Promise<SafeNotification>;
  processQueue(tenantId: string, actorId: string, requestId: string): Promise<void>;
  retryNotification(id: string, tenantId: string, actorId: string, requestId: string): Promise<SafeNotification>;
  cancelNotification(id: string, tenantId: string, actorId: string, requestId: string): Promise<SafeNotification>;
  getNotificationById(id: string, tenantId: string): Promise<SafeNotification>;
  getNotificationByPublicId(publicId: string, tenantId: string): Promise<SafeNotification>;
  listNotifications(params: ListNotificationsParams): Promise<SafeNotification[]>;
  getPatientPreferences(patientId: string, tenantId: string): Promise<NotificationPreferences | null>;
  updatePatientPreferences(patientId: string, tenantId: string, preferences: Partial<NotificationPreferences>): Promise<NotificationPreferences>;
}

// ---------------------------------------------------------------------------
// Repository Interface
// ---------------------------------------------------------------------------

export interface INotificationRepository {
  create(data: {
    tenantId: string;
    clinicId: string;
    patientId?: string | null;
    appointmentId?: string | null;
    conversationId?: string | null;
    recipient: string;
    channel: NotificationChannel;
    type: NotificationType;
    subject?: string | null;
    content: string;
    status: NotificationStatus;
    scheduledAt?: Date | null;
    variables?: Record<string, unknown> | null;
    metadata?: Record<string, unknown> | null;
  }): Promise<unknown>;

  update(
    id: string,
    data: {
      status?: NotificationStatus;
      provider?: string | null;
      retryCount?: number;
      maxRetries?: number;
      failureReason?: string | null;
      scheduledAt?: Date | null;
      sentAt?: Date | null;
      deliveredAt?: Date | null;
      failedAt?: Date | null;
      deletedAt?: Date | null;
    },
  ): Promise<unknown>;

  findById(id: string, includeDeleted?: boolean): Promise<unknown | null>;
  findByPublicId(publicId: string, includeDeleted?: boolean): Promise<unknown | null>;

  findMany(params: {
    tenantId: string;
    clinicId?: string;
    patientId?: string;
    status?: NotificationStatus;
    channel?: NotificationChannel;
    type?: NotificationType;
    scheduledFrom?: Date;
    scheduledTo?: Date;
    limit?: number;
    offset?: number;
    includeDeleted?: boolean;
  }): Promise<unknown[]>;

  findPendingForDelivery(limit: number): Promise<unknown[]>;

  getPatientPreferences(patientId: string, tenantId: string): Promise<unknown | null>;
  updatePatientPreferences(patientId: string, tenantId: string, data: Partial<NotificationPreferences>): Promise<unknown>;

  /** Verify clinic belongs to tenant */
  clinicIsActive(clinicId: string, tenantId: string): Promise<boolean>;

  /** Verify patient belongs to clinic and tenant */
  patientBelongsToClinic(patientId: string, clinicId: string, tenantId: string): Promise<boolean>;

  /** Verify appointment belongs to clinic and tenant */
  appointmentBelongsToClinic(appointmentId: string, clinicId: string, tenantId: string): Promise<boolean>;

  /** Verify conversation belongs to clinic and tenant */
  conversationBelongsToClinic(conversationId: string, clinicId: string, tenantId: string): Promise<boolean>;
}

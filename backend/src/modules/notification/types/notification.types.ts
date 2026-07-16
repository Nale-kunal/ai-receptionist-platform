/**
 * Notification Module Types
 */

import type { NotificationChannel, NotificationStatus, NotificationType } from '../constants/notification.constants';

// ---------------------------------------------------------------------------
// Patient Preferences
// ---------------------------------------------------------------------------

export interface NotificationPreferences {
  smsEnabled: boolean;
  emailEnabled: boolean;
  preferredLanguage: string;
  preferredContactMethod: 'sms' | 'email';
}

// ---------------------------------------------------------------------------
// Safe (Output) Representation
// ---------------------------------------------------------------------------

export interface SafeNotification {
  id: string;
  publicId: string;
  tenantId: string;
  clinicId: string;
  patientId: string | null;
  appointmentId: string | null;
  conversationId: string | null;

  recipient: string;
  channel: NotificationChannel;
  type: NotificationType;
  subject: string | null;
  content: string;

  status: NotificationStatus;
  provider: string | null;
  retryCount: number;
  maxRetries: number;
  failureReason: string | null;

  scheduledAt: Date | null;
  sentAt: Date | null;
  deliveredAt: Date | null;
  failedAt: Date | null;

  variables: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;

  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

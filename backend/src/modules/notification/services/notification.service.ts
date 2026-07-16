/**
 * Notification Service
 *
 * Implements the delivery lifecycle, template rendering, provider selection,
 * preferences validation, retry backoff, and queue processing.
 */

import type {
  INotificationService,
  INotificationRepository,
  CreateNotificationParams,
  ListNotificationsParams,
  INotificationProvider,
  SendResult,
} from '../interfaces/notification.interfaces';
import type { INotificationEventPublisher } from '../events/notification-event.publisher';
import type { SafeNotification, NotificationPreferences } from '../types/notification.types';
import type { NotificationChannel, NotificationStatus, NotificationType } from '../constants/notification.constants';
import {
  NOTIFICATION_STATUS_PENDING,
  NOTIFICATION_STATUS_QUEUED,
  NOTIFICATION_STATUS_SENDING,
  NOTIFICATION_STATUS_SENT,
  NOTIFICATION_STATUS_DELIVERED,
  NOTIFICATION_STATUS_FAILED,
  NOTIFICATION_STATUS_CANCELLED,
  NOTIFICATION_STATUS_EXPIRED,
  TERMINAL_NOTIFICATION_STATUSES,
} from '../constants/notification.constants';
import {
  NotificationNotFoundError,
  NotificationIsolationViolationError,
  InvalidNotificationStatusTransitionError,
  NotificationAlreadyTerminalError,
  ClinicNotActiveForNotificationError,
  NotificationOwnershipError,
  RecipientValidationFailedError,
  NotificationPreferenceRestrictedError,
  TemplateRenderError,
} from '../errors/notification.errors';
import {
  EVENT_NOTIFICATION_CREATED,
  EVENT_NOTIFICATION_QUEUED,
  EVENT_NOTIFICATION_SENT,
  EVENT_NOTIFICATION_DELIVERED,
  EVENT_NOTIFICATION_FAILED,
  EVENT_NOTIFICATION_RETRIED,
  EVENT_NOTIFICATION_CANCELLED,
  EVENT_TEMPLATE_RENDERED,
} from '../events/notification.events';

// ---------------------------------------------------------------------------
// Mock Providers
// ---------------------------------------------------------------------------

export class MockSmtpProvider implements INotificationProvider {
  public async send(recipient: string, content: string, subject?: string): Promise<SendResult> {
    // If recipient email contains 'fail', simulate provider error
    if (recipient.includes('fail')) {
      return { success: false, error: 'SMTP server connection timed out' };
    }
    return { success: true, providerMessageId: `smtp_${Math.random().toString(36).substr(2, 9)}` };
  }
  public getProviderName(): string { return 'smtp'; }
}

export class MockTwilioSmsProvider implements INotificationProvider {
  public async send(recipient: string, content: string): Promise<SendResult> {
    // If phone number ends in '999', simulate provider error
    if (recipient.endsWith('999')) {
      return { success: false, error: 'SMS delivery failed: queue full' };
    }
    return { success: true, providerMessageId: `twilio_${Math.random().toString(36).substr(2, 9)}` };
  }
  public getProviderName(): string { return 'twilio_sms'; }
}

export class MockProvider implements INotificationProvider {
  public async send(): Promise<SendResult> {
    return { success: true, providerMessageId: `mock_${Math.random().toString(36).substr(2, 9)}` };
  }
  public getProviderName(): string { return 'mock'; }
}

// ---------------------------------------------------------------------------
// Templates List
// ---------------------------------------------------------------------------

interface TemplateConfig {
  subjectTemplate?: string;
  bodyTemplate: string;
}

const TEMPLATES: Record<string, TemplateConfig> = {
  appointment_confirmation: {
    subjectTemplate: 'Appointment Confirmed',
    bodyTemplate: 'Hello {{patientName}}, your appointment with Dr. {{doctorName}} on {{appointmentDate}} at {{appointmentTime}} has been confirmed.',
  },
  appointment_reminder: {
    subjectTemplate: 'Appointment Reminder',
    bodyTemplate: 'Hi {{patientName}}, this is a reminder for your appointment on {{appointmentDate}} at {{appointmentTime}}.',
  },
  appointment_rescheduled: {
    subjectTemplate: 'Appointment Rescheduled',
    bodyTemplate: 'Hi {{patientName}}, your appointment has been rescheduled to {{appointmentDate}} at {{appointmentTime}}.',
  },
  appointment_cancelled: {
    subjectTemplate: 'Appointment Cancelled',
    bodyTemplate: 'Hi {{patientName}}, your appointment on {{appointmentDate}} has been cancelled.',
  },
  password_reset: {
    subjectTemplate: 'Password Reset Request',
    bodyTemplate: 'Use code {{resetCode}} or link {{resetLink}} to reset your password.',
  },
  email_verification: {
    subjectTemplate: 'Verify your email',
    bodyTemplate: 'Use link {{verificationLink}} to verify your email.',
  },
  welcome_message: {
    subjectTemplate: 'Welcome to our clinic',
    bodyTemplate: 'Welcome {{patientName}}!',
  },
  system_notification: {
    subjectTemplate: 'System Alert',
    bodyTemplate: 'Alert: {{message}}',
  },
};

// ---------------------------------------------------------------------------
// State Machine Transitions
// ---------------------------------------------------------------------------

const ALLOWED_TRANSITIONS: Record<NotificationStatus, NotificationStatus[]> = {
  [NOTIFICATION_STATUS_PENDING]: [
    NOTIFICATION_STATUS_QUEUED,
    NOTIFICATION_STATUS_CANCELLED,
  ],
  [NOTIFICATION_STATUS_QUEUED]: [
    NOTIFICATION_STATUS_SENDING,
    NOTIFICATION_STATUS_CANCELLED,
  ],
  [NOTIFICATION_STATUS_SENDING]: [
    NOTIFICATION_STATUS_SENT,
    NOTIFICATION_STATUS_FAILED,
    NOTIFICATION_STATUS_CANCELLED,
  ],
  [NOTIFICATION_STATUS_SENT]: [
    NOTIFICATION_STATUS_DELIVERED,
    NOTIFICATION_STATUS_FAILED,
    NOTIFICATION_STATUS_EXPIRED,
  ],
  [NOTIFICATION_STATUS_FAILED]: [
    NOTIFICATION_STATUS_PENDING,
    NOTIFICATION_STATUS_QUEUED,
    NOTIFICATION_STATUS_CANCELLED,
  ],
  [NOTIFICATION_STATUS_DELIVERED]: [],
  [NOTIFICATION_STATUS_CANCELLED]: [],
  [NOTIFICATION_STATUS_EXPIRED]:   [],
};

// ---------------------------------------------------------------------------
// Service Implementation
// ---------------------------------------------------------------------------

export class NotificationService implements INotificationService {
  private readonly providers: Record<NotificationChannel, INotificationProvider>;

  constructor(
    private readonly repository: INotificationRepository,
    private readonly publisher: INotificationEventPublisher,
    customProviders?: Record<NotificationChannel, INotificationProvider>,
  ) {
    this.providers = customProviders ?? {
      email: new MockSmtpProvider(),
      sms:   new MockTwilioSmsProvider(),
    };
  }

  // -------------------------------------------------------------------------
  // Create (Enqueue)
  // -------------------------------------------------------------------------

  public async createNotification(params: CreateNotificationParams): Promise<SafeNotification> {
    // 1. Clinic is active
    const clinicActive = await this.repository.clinicIsActive(params.clinicId, params.tenantId);
    if (!clinicActive) {
      throw new ClinicNotActiveForNotificationError();
    }

    // 2. Validate linked references
    if (params.patientId) {
      const valid = await this.repository.patientBelongsToClinic(params.patientId, params.clinicId, params.tenantId);
      if (!valid) throw new NotificationOwnershipError('Patient');
    }
    if (params.appointmentId) {
      const valid = await this.repository.appointmentBelongsToClinic(params.appointmentId, params.clinicId, params.tenantId);
      if (!valid) throw new NotificationOwnershipError('Appointment');
    }
    if (params.conversationId) {
      const valid = await this.repository.conversationBelongsToClinic(params.conversationId, params.clinicId, params.tenantId);
      if (!valid) throw new NotificationOwnershipError('Conversation');
    }

    // 3. Destination validation
    this.validateDestination(params.channel, params.recipient);

    // 4. Preferences validation
    if (params.patientId) {
      const prefs = await this.getPatientPreferences(params.patientId, params.tenantId);
      if (prefs) {
        if (params.channel === 'sms' && !prefs.smsEnabled) {
          throw new NotificationPreferenceRestrictedError('sms');
        }
        if (params.channel === 'email' && !prefs.emailEnabled) {
          throw new NotificationPreferenceRestrictedError('email');
        }
      }
    }

    // 5. Template rendering
    const variables = params.variables ?? {};
    const rendered = this.renderTemplate(params.templateName, variables);

    // 6. Persist
    const created = await this.repository.create({
      tenantId:       params.tenantId,
      clinicId:       params.clinicId,
      patientId:      params.patientId,
      appointmentId:  params.appointmentId,
      conversationId: params.conversationId,
      recipient:      params.recipient,
      channel:        params.channel,
      type:           params.type,
      subject:        params.subject ?? rendered.subject,
      content:        rendered.body,
      status:         NOTIFICATION_STATUS_PENDING,
      scheduledAt:    params.scheduledAt,
      variables,
      metadata:       params.metadata,
    });

    const safe = this.toSafe(created);

    // 7. Audit events
    await this.publisher.publish({
      type: EVENT_NOTIFICATION_CREATED,
      payload: {
        tenantId:       safe.tenantId,
        clinicId:       safe.clinicId,
        notificationId: safe.id,
        actorId:        params.actorId,
        requestId:      params.requestId,
        occurredAt:     new Date(),
        recipient:      safe.recipient,
        channel:        safe.channel,
        type:           safe.type,
      },
    });

    await this.publisher.publish({
      type: EVENT_TEMPLATE_RENDERED,
      payload: {
        tenantId:       safe.tenantId,
        clinicId:       safe.clinicId,
        notificationId: safe.id,
        actorId:        params.actorId,
        requestId:      params.requestId,
        occurredAt:     new Date(),
        templateName:   params.templateName,
        variables:      Object.keys(variables),
      },
    });

    return safe;
  }

  // -------------------------------------------------------------------------
  // Send Immediate
  // -------------------------------------------------------------------------

  public async sendImmediate(
    id: string,
    tenantId: string,
    actorId: string,
    requestId: string,
  ): Promise<SafeNotification> {
    const existing = await this.requireNotification(id, tenantId);
    this.assertTransitionAllowed(existing.status, NOTIFICATION_STATUS_QUEUED);

    // Transition: pending -> queued
    let current = await this.updateStatus(id, NOTIFICATION_STATUS_QUEUED);
    await this.publisher.publish({
      type: EVENT_NOTIFICATION_QUEUED,
      payload: {
        tenantId:       current.tenantId,
        clinicId:       current.clinicId,
        notificationId: current.id,
        actorId,
        requestId,
        occurredAt:     new Date(),
        scheduledAt:    current.scheduledAt,
      },
    });

    // Transition: queued -> sending
    this.assertTransitionAllowed(current.status, NOTIFICATION_STATUS_SENDING);
    current = await this.updateStatus(id, NOTIFICATION_STATUS_SENDING);

    const provider = this.providers[current.channel];
    const providerName = provider.getProviderName();

    try {
      const res = await provider.send(current.recipient, current.content, current.subject ?? undefined);

      if (res.success) {
        // Transition: sending -> sent
        this.assertTransitionAllowed(current.status, NOTIFICATION_STATUS_SENT);
        await this.repository.update(id, {
          status:   NOTIFICATION_STATUS_SENT,
          provider: providerName,
          sentAt:   new Date(),
        });

        // Transition: sent -> delivered
        this.assertTransitionAllowed(NOTIFICATION_STATUS_SENT, NOTIFICATION_STATUS_DELIVERED);
        const delivered = await this.repository.update(id, {
          status:      NOTIFICATION_STATUS_DELIVERED,
          deliveredAt: new Date(),
        });

        const safeDelivered = this.toSafe(delivered);

        await this.publisher.publish({
          type: EVENT_NOTIFICATION_SENT,
          payload: {
            tenantId:       safeDelivered.tenantId,
            clinicId:       safeDelivered.clinicId,
            notificationId: safeDelivered.id,
            actorId,
            requestId,
            occurredAt:     new Date(),
            provider:       providerName,
          },
        });

        await this.publisher.publish({
          type: EVENT_NOTIFICATION_DELIVERED,
          payload: {
            tenantId:       safeDelivered.tenantId,
            clinicId:       safeDelivered.clinicId,
            notificationId: safeDelivered.id,
            actorId,
            requestId,
            occurredAt:     new Date(),
            deliveredAt:    safeDelivered.deliveredAt!,
          },
        });

        return safeDelivered;
      } else {
        throw new Error(res.error ?? 'Unknown delivery error');
      }
    } catch (err: any) {
      const errMsg = err.message || 'Delivery error';

      // Transition: sending -> failed
      this.assertTransitionAllowed(current.status, NOTIFICATION_STATUS_FAILED);

      const willRetry = current.retryCount < current.maxRetries;
      const failed = await this.repository.update(id, {
        status:        NOTIFICATION_STATUS_FAILED,
        provider:      providerName,
        failureReason: errMsg,
        failedAt:      new Date(),
      });

      const safeFailed = this.toSafe(failed);

      await this.publisher.publish({
        type: EVENT_NOTIFICATION_FAILED,
        payload: {
          tenantId:       safeFailed.tenantId,
          clinicId:       safeFailed.clinicId,
          notificationId: safeFailed.id,
          actorId,
          requestId,
          occurredAt:     new Date(),
          reason:         errMsg,
          willRetry,
        },
      });

      if (willRetry) {
        // Schedule retry with linear backoff (retryCount * 60 seconds)
        return this.retryNotification(id, tenantId, actorId, requestId);
      }

      return safeFailed;
    }
  }

  // -------------------------------------------------------------------------
  // Retry Failed
  // -------------------------------------------------------------------------

  public async retryNotification(
    id: string,
    tenantId: string,
    actorId: string,
    requestId: string,
  ): Promise<SafeNotification> {
    const existing = await this.requireNotification(id, tenantId);
    this.assertTransitionAllowed(existing.status, NOTIFICATION_STATUS_QUEUED);

    const newRetryCount = existing.retryCount + 1;
    const backoffSeconds = newRetryCount * 60;
    const nextAttemptAt = new Date(Date.now() + backoffSeconds * 1000);

    const updated = await this.repository.update(id, {
      status:      NOTIFICATION_STATUS_QUEUED,
      retryCount:  newRetryCount,
      scheduledAt: nextAttemptAt,
    });

    const safe = this.toSafe(updated);

    await this.publisher.publish({
      type: EVENT_NOTIFICATION_RETRIED,
      payload: {
        tenantId:       safe.tenantId,
        clinicId:       safe.clinicId,
        notificationId: safe.id,
        actorId,
        requestId,
        occurredAt:     new Date(),
        retryCount:     newRetryCount,
      },
    });

    return safe;
  }

  // -------------------------------------------------------------------------
  // Process Queue
  // -------------------------------------------------------------------------

  public async processQueue(tenantId: string, actorId: string, requestId: string): Promise<void> {
    // Process up to 50 pending/due notifications
    const pending = await this.repository.findPendingForDelivery(50);
    for (const record of pending) {
      const notification = record as { id: string; tenantId: string };
      if (notification.tenantId === tenantId) {
        try {
          await this.sendImmediate(notification.id, tenantId, actorId, requestId);
        } catch (err) {
          console.error(`Error processing queued notification ${notification.id}:`, err);
        }
      }
    }
  }

  // -------------------------------------------------------------------------
  // Cancel
  // -------------------------------------------------------------------------

  public async cancelNotification(
    id: string,
    tenantId: string,
    actorId: string,
    requestId: string,
  ): Promise<SafeNotification> {
    const existing = await this.requireNotification(id, tenantId);
    this.assertTransitionAllowed(existing.status, NOTIFICATION_STATUS_CANCELLED);

    const updated = await this.repository.update(id, { status: NOTIFICATION_STATUS_CANCELLED });
    const safe = this.toSafe(updated);

    await this.publisher.publish({
      type: EVENT_NOTIFICATION_CANCELLED,
      payload: {
        tenantId:       safe.tenantId,
        clinicId:       safe.clinicId,
        notificationId: safe.id,
        actorId,
        requestId,
        occurredAt:     new Date(),
      },
    });

    return safe;
  }

  // -------------------------------------------------------------------------
  // Preferences Management
  // -------------------------------------------------------------------------

  public async getPatientPreferences(patientId: string, tenantId: string): Promise<NotificationPreferences | null> {
    const raw = await this.repository.getPatientPreferences(patientId, tenantId);
    if (!raw) return null;
    const p = raw as {
      smsEnabled: boolean;
      emailEnabled: boolean;
      preferredLanguage: string;
      preferredContactMethod: string;
    };
    return {
      smsEnabled:             p.smsEnabled,
      emailEnabled:           p.emailEnabled,
      preferredLanguage:      p.preferredLanguage,
      preferredContactMethod: p.preferredContactMethod as 'sms' | 'email',
    };
  }

  public async updatePatientPreferences(
    patientId: string,
    tenantId: string,
    preferences: Partial<NotificationPreferences>,
  ): Promise<NotificationPreferences> {
    const updated = await this.repository.updatePatientPreferences(patientId, tenantId, preferences);
    const p = updated as {
      smsEnabled: boolean;
      emailEnabled: boolean;
      preferredLanguage: string;
      preferredContactMethod: string;
    };
    return {
      smsEnabled:             p.smsEnabled,
      emailEnabled:           p.emailEnabled,
      preferredLanguage:      p.preferredLanguage,
      preferredContactMethod: p.preferredContactMethod as 'sms' | 'email',
    };
  }

  // -------------------------------------------------------------------------
  // Read
  // -------------------------------------------------------------------------

  public async getNotificationById(id: string, tenantId: string): Promise<SafeNotification> {
    const record = await this.repository.findById(id);
    if (!record) throw new NotificationNotFoundError(id);
    const safe = this.toSafe(record);
    if (safe.tenantId !== tenantId) throw new NotificationIsolationViolationError();
    return safe;
  }

  public async getNotificationByPublicId(publicId: string, tenantId: string): Promise<SafeNotification> {
    const record = await this.repository.findByPublicId(publicId);
    if (!record) throw new NotificationNotFoundError();
    const safe = this.toSafe(record);
    if (safe.tenantId !== tenantId) throw new NotificationIsolationViolationError();
    return safe;
  }

  public async listNotifications(params: ListNotificationsParams): Promise<SafeNotification[]> {
    const records = await this.repository.findMany({
      tenantId:      params.tenantId,
      clinicId:      params.clinicId,
      patientId:     params.patientId,
      status:        params.status,
      channel:       params.channel,
      type:          params.type,
      scheduledFrom: params.scheduledFrom,
      scheduledTo:   params.scheduledTo,
      limit:         params.limit,
      offset:        params.offset,
    });
    return records.map((r) => this.toSafe(r));
  }

  // -------------------------------------------------------------------------
  // Private Helpers
  // -------------------------------------------------------------------------

  private async requireNotification(id: string, tenantId: string): Promise<SafeNotification> {
    const record = await this.repository.findById(id);
    if (!record) throw new NotificationNotFoundError(id);
    const safe = this.toSafe(record);
    if (safe.tenantId !== tenantId) throw new NotificationIsolationViolationError();
    return safe;
  }

  private validateDestination(channel: NotificationChannel, recipient: string): void {
    if (channel === 'email' && !recipient.includes('@')) {
      throw new RecipientValidationFailedError('Invalid email address format.');
    }
    if (channel === 'sms' && !/^\+?[1-9]\d{1,14}$/.test(recipient)) {
      throw new RecipientValidationFailedError('Invalid SMS E.164 phone number format.');
    }
  }

  private renderTemplate(templateName: string, variables: Record<string, unknown>): { subject?: string; body: string } {
    const template = TEMPLATES[templateName];
    if (!template) {
      throw new TemplateRenderError(`Template '${templateName}' not found.`);
    }

    let subject: string | undefined;
    if (template.subjectTemplate) {
      subject = template.subjectTemplate;
      for (const [key, value] of Object.entries(variables)) {
        subject = subject.replace(new RegExp(`{{${key}}}`, 'g'), String(value));
      }
    }

    let body = template.bodyTemplate;
    for (const [key, value] of Object.entries(variables)) {
      body = body.replace(new RegExp(`{{${key}}}`, 'g'), String(value));
    }

    return { subject, body };
  }

  private async updateStatus(id: string, status: NotificationStatus): Promise<SafeNotification> {
    const updated = await this.repository.update(id, { status });
    return this.toSafe(updated);
  }

  private assertTransitionAllowed(from: NotificationStatus, to: NotificationStatus): void {
    if ((TERMINAL_NOTIFICATIONS_AS_STRINGS() as string[]).includes(from)) {
      throw new NotificationAlreadyTerminalError(from);
    }
    const allowed = ALLOWED_TRANSITIONS[from] ?? [];
    if (!allowed.includes(to)) {
      throw new InvalidNotificationStatusTransitionError(from, to);
    }
  }

  private toSafe(record: any): SafeNotification {
    return {
      id:             record.id,
      publicId:       record.publicId,
      tenantId:       record.tenantId,
      clinicId:       record.clinicId,
      patientId:      record.patientId ?? null,
      appointmentId:  record.appointmentId ?? null,
      conversationId: record.conversationId ?? null,
      recipient:      record.recipient,
      channel:        record.channel as NotificationChannel,
      type:           record.type as NotificationType,
      subject:        record.subject ?? null,
      content:        record.content,
      status:         record.status as NotificationStatus,
      provider:       record.provider ?? null,
      retryCount:     record.retryCount ?? 0,
      maxRetries:     record.maxRetries ?? 3,
      failureReason:  record.failureReason ?? null,
      scheduledAt:    record.scheduledAt ?? null,
      sentAt:         record.sentAt ?? null,
      deliveredAt:    record.deliveredAt ?? null,
      failedAt:       record.failedAt ?? null,
      variables:      record.variables ? (record.variables as Record<string, unknown>) : null,
      metadata:       record.metadata ? (record.metadata as Record<string, unknown>) : null,
      createdAt:      record.createdAt,
      updatedAt:      record.updatedAt,
      deletedAt:      record.deletedAt ?? null,
    };
  }
}

function TERMINAL_NOTIFICATIONS_AS_STRINGS(): string[] {
  return TERMINAL_NOTIFICATION_STATUSES as unknown as string[];
}

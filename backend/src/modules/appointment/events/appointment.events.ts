/**
 * Appointment Module Domain Events
 */

// ---------------------------------------------------------------------------
// Event Type Constants
// ---------------------------------------------------------------------------

export const EVENT_APPOINTMENT_CREATED     = 'appointment.created'     as const;
export const EVENT_APPOINTMENT_UPDATED     = 'appointment.updated'     as const;
export const EVENT_APPOINTMENT_CONFIRMED   = 'appointment.confirmed'   as const;
export const EVENT_APPOINTMENT_CHECKED_IN  = 'appointment.checked_in'  as const;
export const EVENT_APPOINTMENT_IN_PROGRESS = 'appointment.in_progress' as const;
export const EVENT_APPOINTMENT_CANCELLED   = 'appointment.cancelled'   as const;
export const EVENT_APPOINTMENT_RESCHEDULED = 'appointment.rescheduled' as const;
export const EVENT_APPOINTMENT_COMPLETED   = 'appointment.completed'   as const;
export const EVENT_APPOINTMENT_NO_SHOW     = 'appointment.no_show'     as const;

// ---------------------------------------------------------------------------
// Base Payload (every event includes these fields per contract)
// ---------------------------------------------------------------------------

export interface BaseAppointmentEventPayload {
  tenantId: string;
  clinicId: string;
  doctorId: string;
  patientId: string;
  appointmentId: string;
  actorId: string;
  requestId: string;
  occurredAt: Date;
}

// ---------------------------------------------------------------------------
// Typed Event Interfaces
// ---------------------------------------------------------------------------

export interface AppointmentCreatedEvent {
  type: typeof EVENT_APPOINTMENT_CREATED;
  payload: BaseAppointmentEventPayload & {
    startTime: Date;
    endTime: Date;
    timezone: string;
    source: string;
  };
}

export interface AppointmentUpdatedEvent {
  type: typeof EVENT_APPOINTMENT_UPDATED;
  payload: BaseAppointmentEventPayload & {
    changedFields: string[];
    previous: unknown;
    current: unknown;
  };
}

export interface AppointmentConfirmedEvent {
  type: typeof EVENT_APPOINTMENT_CONFIRMED;
  payload: BaseAppointmentEventPayload;
}

export interface AppointmentCheckedInEvent {
  type: typeof EVENT_APPOINTMENT_CHECKED_IN;
  payload: BaseAppointmentEventPayload;
}

export interface AppointmentInProgressEvent {
  type: typeof EVENT_APPOINTMENT_IN_PROGRESS;
  payload: BaseAppointmentEventPayload;
}

export interface AppointmentCancelledEvent {
  type: typeof EVENT_APPOINTMENT_CANCELLED;
  payload: BaseAppointmentEventPayload & {
    cancellationReason: string | null;
  };
}

export interface AppointmentRescheduledEvent {
  type: typeof EVENT_APPOINTMENT_RESCHEDULED;
  payload: BaseAppointmentEventPayload & {
    previousStartTime: Date;
    previousEndTime: Date;
    newStartTime: Date;
    newEndTime: Date;
  };
}

export interface AppointmentCompletedEvent {
  type: typeof EVENT_APPOINTMENT_COMPLETED;
  payload: BaseAppointmentEventPayload;
}

export interface AppointmentNoShowEvent {
  type: typeof EVENT_APPOINTMENT_NO_SHOW;
  payload: BaseAppointmentEventPayload;
}

// ---------------------------------------------------------------------------
// Union Type
// ---------------------------------------------------------------------------

export type AppointmentDomainEvent =
  | AppointmentCreatedEvent
  | AppointmentUpdatedEvent
  | AppointmentConfirmedEvent
  | AppointmentCheckedInEvent
  | AppointmentInProgressEvent
  | AppointmentCancelledEvent
  | AppointmentRescheduledEvent
  | AppointmentCompletedEvent
  | AppointmentNoShowEvent;

/**
 * Patient Module Domain Events
 */

export const EVENT_PATIENT_CREATED = 'patient.created' as const;
export const EVENT_PATIENT_UPDATED = 'patient.updated' as const;
export const EVENT_PATIENT_ACTIVATED = 'patient.activated' as const;
export const EVENT_PATIENT_DEACTIVATED = 'patient.deactivated' as const;
export const EVENT_PATIENT_BLOCKED = 'patient.blocked' as const;
export const EVENT_PATIENT_ARCHIVED = 'patient.archived' as const;
export const EVENT_PATIENT_DELETED = 'patient.deleted' as const;
export const EVENT_PATIENT_RESTORED = 'patient.restored' as const;

export interface BasePatientEventPayload {
  tenantId: string;
  clinicId: string;
  patientId: string;
  actorId: string;
  requestId: string;
  occurredAt: Date;
}

export interface PatientCreatedEvent {
  type: typeof EVENT_PATIENT_CREATED;
  payload: BasePatientEventPayload & {
    fullName: string;
    phone: string;
    email?: string | null;
  };
}

export interface PatientUpdatedEvent {
  type: typeof EVENT_PATIENT_UPDATED;
  payload: BasePatientEventPayload & {
    changedFields: string[];
    previous: any;
    current: any;
  };
}

export interface PatientActivatedEvent {
  type: typeof EVENT_PATIENT_ACTIVATED;
  payload: BasePatientEventPayload;
}

export interface PatientDeactivatedEvent {
  type: typeof EVENT_PATIENT_DEACTIVATED;
  payload: BasePatientEventPayload;
}

export interface PatientBlockedEvent {
  type: typeof EVENT_PATIENT_BLOCKED;
  payload: BasePatientEventPayload;
}

export interface PatientArchivedEvent {
  type: typeof EVENT_PATIENT_ARCHIVED;
  payload: BasePatientEventPayload;
}

export interface PatientDeletedEvent {
  type: typeof EVENT_PATIENT_DELETED;
  payload: BasePatientEventPayload;
}

export interface PatientRestoredEvent {
  type: typeof EVENT_PATIENT_RESTORED;
  payload: BasePatientEventPayload;
}

export type PatientDomainEvent =
  | PatientCreatedEvent
  | PatientUpdatedEvent
  | PatientActivatedEvent
  | PatientDeactivatedEvent
  | PatientBlockedEvent
  | PatientArchivedEvent
  | PatientDeletedEvent
  | PatientRestoredEvent;

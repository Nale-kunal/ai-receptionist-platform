/**
 * Doctor Module Domain Events
 */

import type { WorkingHourInterval, DoctorLeaveInterval } from '../types/doctor.types';

export const EVENT_DOCTOR_CREATED = 'doctor.created' as const;
export const EVENT_DOCTOR_UPDATED = 'doctor.updated' as const;
export const EVENT_DOCTOR_ACTIVATED = 'doctor.activated' as const;
export const EVENT_DOCTOR_DEACTIVATED = 'doctor.deactivated' as const;
export const EVENT_DOCTOR_ARCHIVED = 'doctor.archived' as const;
export const EVENT_DOCTOR_DELETED = 'doctor.deleted' as const;
export const EVENT_DOCTOR_RESTORED = 'doctor.restored' as const;
export const EVENT_DOCTOR_AVAILABILITY_UPDATED = 'doctor.availability-updated' as const;
export const EVENT_DOCTOR_WORKING_HOURS_UPDATED = 'doctor.working-hours-updated' as const;
export const EVENT_DOCTOR_CLINIC_CHANGED = 'doctor.clinic-changed' as const;

export interface BaseDoctorEventPayload {
  tenantId: string;
  clinicId: string;
  doctorId: string;
  actorId: string;
  requestId: string;
  occurredAt: Date;
}

export interface DoctorCreatedEvent {
  type: typeof EVENT_DOCTOR_CREATED;
  payload: BaseDoctorEventPayload & {
    fullName: string;
    displayName: string;
    specialization: string;
  };
}

export interface DoctorUpdatedEvent {
  type: typeof EVENT_DOCTOR_UPDATED;
  payload: BaseDoctorEventPayload & {
    changedFields: string[];
    previous: any;
    current: any;
  };
}

export interface DoctorActivatedEvent {
  type: typeof EVENT_DOCTOR_ACTIVATED;
  payload: BaseDoctorEventPayload;
}

export interface DoctorDeactivatedEvent {
  type: typeof EVENT_DOCTOR_DEACTIVATED;
  payload: BaseDoctorEventPayload & {
    reasonStatus: string;
  };
}

export interface DoctorArchivedEvent {
  type: typeof EVENT_DOCTOR_ARCHIVED;
  payload: BaseDoctorEventPayload;
}

export interface DoctorDeletedEvent {
  type: typeof EVENT_DOCTOR_DELETED;
  payload: BaseDoctorEventPayload;
}

export interface DoctorRestoredEvent {
  type: typeof EVENT_DOCTOR_RESTORED;
  payload: BaseDoctorEventPayload;
}

export interface DoctorAvailabilityUpdatedEvent {
  type: typeof EVENT_DOCTOR_AVAILABILITY_UPDATED;
  payload: BaseDoctorEventPayload & {
    leaves: DoctorLeaveInterval[];
  };
}

export interface DoctorWorkingHoursUpdatedEvent {
  type: typeof EVENT_DOCTOR_WORKING_HOURS_UPDATED;
  payload: BaseDoctorEventPayload & {
    workingHours: WorkingHourInterval[];
  };
}

export interface DoctorClinicChangedEvent {
  type: typeof EVENT_DOCTOR_CLINIC_CHANGED;
  payload: BaseDoctorEventPayload & {
    previousClinicId: string;
    newClinicId: string;
  };
}

export type DoctorDomainEvent =
  | DoctorCreatedEvent
  | DoctorUpdatedEvent
  | DoctorActivatedEvent
  | DoctorDeactivatedEvent
  | DoctorArchivedEvent
  | DoctorDeletedEvent
  | DoctorRestoredEvent
  | DoctorAvailabilityUpdatedEvent
  | DoctorWorkingHoursUpdatedEvent
  | DoctorClinicChangedEvent;

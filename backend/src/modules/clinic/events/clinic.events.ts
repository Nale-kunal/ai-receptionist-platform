/**
 * Clinic Module Domain Events
 */

export const EVENT_CLINIC_CREATED = 'clinic.created' as const;
export const EVENT_CLINIC_UPDATED = 'clinic.updated' as const;
export const EVENT_CLINIC_ACTIVATED = 'clinic.activated' as const;
export const EVENT_CLINIC_SUSPENDED = 'clinic.suspended' as const;
export const EVENT_CLINIC_ARCHIVED = 'clinic.archived' as const;
export const EVENT_CLINIC_DELETED = 'clinic.deleted' as const;
export const EVENT_CLINIC_RESTORED = 'clinic.restored' as const;
export const EVENT_CLINIC_OWNERSHIP_TRANSFERRED = 'clinic.ownership-transferred' as const;

export interface BaseClinicEventPayload {
  tenantId: string;
  clinicId: string;
  actorId: string;
  requestId: string;
  occurredAt: Date;
}

export interface ClinicCreatedEvent {
  type: typeof EVENT_CLINIC_CREATED;
  payload: BaseClinicEventPayload & {
    ownerId: string;
    name: string;
    slug: string;
  };
}

export interface ClinicUpdatedEvent {
  type: typeof EVENT_CLINIC_UPDATED;
  payload: BaseClinicEventPayload & {
    changedFields: string[];
    previous: any;
    current: any;
  };
}

export interface ClinicActivatedEvent {
  type: typeof EVENT_CLINIC_ACTIVATED;
  payload: BaseClinicEventPayload;
}

export interface ClinicSuspendedEvent {
  type: typeof EVENT_CLINIC_SUSPENDED;
  payload: BaseClinicEventPayload;
}

export interface ClinicArchivedEvent {
  type: typeof EVENT_CLINIC_ARCHIVED;
  payload: BaseClinicEventPayload;
}

export interface ClinicDeletedEvent {
  type: typeof EVENT_CLINIC_DELETED;
  payload: BaseClinicEventPayload;
}

export interface ClinicRestoredEvent {
  type: typeof EVENT_CLINIC_RESTORED;
  payload: BaseClinicEventPayload;
}

export interface ClinicOwnershipTransferredEvent {
  type: typeof EVENT_CLINIC_OWNERSHIP_TRANSFERRED;
  payload: BaseClinicEventPayload & {
    previousOwnerId: string;
    newOwnerId: string;
  };
}

export type ClinicDomainEvent =
  | ClinicCreatedEvent
  | ClinicUpdatedEvent
  | ClinicActivatedEvent
  | ClinicSuspendedEvent
  | ClinicArchivedEvent
  | ClinicDeletedEvent
  | ClinicRestoredEvent
  | ClinicOwnershipTransferredEvent;

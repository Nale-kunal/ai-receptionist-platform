/**
 * Conversation Orchestrator Domain Events with Correlation metadata
 */

import type { EventCorrelation, OrchestrationTurn, OrchestrationContext } from './conversation-orchestrator.types';

export const EVENT_ORCHESTRATOR_CREATED             = 'conversation.created'            as const;
export const EVENT_ORCHESTRATOR_STARTED             = 'conversation.started'            as const;
export const EVENT_ORCHESTRATOR_TURN_STARTED         = 'conversation.turn.started'         as const;
export const EVENT_ORCHESTRATOR_TURN_COMPLETED       = 'conversation.turn.completed'       as const;
export const EVENT_ORCHESTRATOR_CONTEXT_UPDATED      = 'conversation.context.updated'      as const;
export const EVENT_ORCHESTRATOR_INTERRUPTED          = 'conversation.interrupted'          as const;
export const EVENT_ORCHESTRATOR_RESUMED              = 'conversation.resumed'              as const;
export const EVENT_ORCHESTRATOR_RESPONSE_GENERATED  = 'conversation.response.generated'  as const;
export const EVENT_ORCHESTRATOR_SNAPSHOT_CREATED    = 'conversation.snapshot.created'    as const;
export const EVENT_ORCHESTRATOR_SNAPSHOT_RESTORED   = 'conversation.snapshot.restored'   as const;
export const EVENT_ORCHESTRATOR_RECOVERED            = 'conversation.recovered'            as const;
export const EVENT_ORCHESTRATOR_TIMEOUT              = 'conversation.timeout'              as const;
export const EVENT_ORCHESTRATOR_COMPLETED            = 'conversation.completed'            as const;
export const EVENT_ORCHESTRATOR_FAILED               = 'conversation.failed'               as const;

export interface OrchestratorCreatedEvent {
  type: typeof EVENT_ORCHESTRATOR_CREATED;
  correlation: EventCorrelation;
  payload: {
    sessionId: string;
    tenantId: string;
    clinicId: string | null;
    conversationId: string;
  };
}

export interface OrchestratorStartedEvent {
  type: typeof EVENT_ORCHESTRATOR_STARTED;
  correlation: EventCorrelation;
  payload: {
    sessionId: string;
    tenantId: string;
  };
}

export interface OrchestratorTurnStartedEvent {
  type: typeof EVENT_ORCHESTRATOR_TURN_STARTED;
  correlation: EventCorrelation;
  payload: {
    sessionId: string;
    tenantId: string;
    turn: OrchestrationTurn;
  };
}

export interface OrchestratorTurnCompletedEvent {
  type: typeof EVENT_ORCHESTRATOR_TURN_COMPLETED;
  correlation: EventCorrelation;
  payload: {
    sessionId: string;
    tenantId: string;
    turn: OrchestrationTurn;
  };
}

export interface OrchestratorContextUpdatedEvent {
  type: typeof EVENT_ORCHESTRATOR_CONTEXT_UPDATED;
  correlation: EventCorrelation;
  payload: {
    sessionId: string;
    tenantId: string;
    context: OrchestrationContext;
  };
}

export interface OrchestratorInterruptedEvent {
  type: typeof EVENT_ORCHESTRATOR_INTERRUPTED;
  correlation: EventCorrelation;
  payload: {
    sessionId: string;
    tenantId: string;
    audioOffsetMs: number;
  };
}

export interface OrchestratorResumedEvent {
  type: typeof EVENT_ORCHESTRATOR_RESUMED;
  correlation: EventCorrelation;
  payload: {
    sessionId: string;
    tenantId: string;
  };
}

export interface OrchestratorSnapshotCreatedEvent {
  type: typeof EVENT_ORCHESTRATOR_SNAPSHOT_CREATED;
  correlation: EventCorrelation;
  payload: {
    sessionId: string;
    tenantId: string;
    snapshotId: string;
  };
}

export interface OrchestratorSnapshotRestoredEvent {
  type: typeof EVENT_ORCHESTRATOR_SNAPSHOT_RESTORED;
  correlation: EventCorrelation;
  payload: {
    sessionId: string;
    tenantId: string;
    snapshotId: string;
  };
}

export interface OrchestratorRecoveredEvent {
  type: typeof EVENT_ORCHESTRATOR_RECOVERED;
  correlation: EventCorrelation;
  payload: {
    sessionId: string;
    tenantId: string;
  };
}

export interface OrchestratorTimeoutEvent {
  type: typeof EVENT_ORCHESTRATOR_TIMEOUT;
  correlation: EventCorrelation;
  payload: {
    sessionId: string;
    tenantId: string;
    timeoutType: string;
    limitMs: number;
  };
}

export interface OrchestratorCompletedEvent {
  type: typeof EVENT_ORCHESTRATOR_COMPLETED;
  correlation: EventCorrelation;
  payload: {
    sessionId: string;
    tenantId: string;
    durationMs: number;
  };
}

export interface OrchestratorFailedEvent {
  type: typeof EVENT_ORCHESTRATOR_FAILED;
  correlation: EventCorrelation;
  payload: {
    sessionId: string;
    tenantId: string;
    errorCode: string;
    errorMessage: string;
  };
}
export interface OrchestratorResponseGeneratedEvent {
  type: typeof EVENT_ORCHESTRATOR_RESPONSE_GENERATED;
  correlation: EventCorrelation;
  payload: {
    sessionId: string;
    tenantId: string;
    text: string;
  };
}

export type OrchestratorDomainEvent =
  | OrchestratorCreatedEvent
  | OrchestratorStartedEvent
  | OrchestratorTurnStartedEvent
  | OrchestratorTurnCompletedEvent
  | OrchestratorContextUpdatedEvent
  | OrchestratorInterruptedEvent
  | OrchestratorResumedEvent
  | OrchestratorResponseGeneratedEvent
  | OrchestratorSnapshotCreatedEvent
  | OrchestratorSnapshotRestoredEvent
  | OrchestratorRecoveredEvent
  | OrchestratorTimeoutEvent
  | OrchestratorCompletedEvent
  | OrchestratorFailedEvent;

export interface IOrchestratorEventPublisher {
  publish(event: OrchestratorDomainEvent): Promise<void>;
  subscribe(
    eventType: OrchestratorDomainEvent['type'],
    handler: (event: OrchestratorDomainEvent) => void | Promise<void>
  ): void;
}

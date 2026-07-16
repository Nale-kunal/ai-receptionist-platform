/**
 * Conversation Orchestrator Domain Events
 */

import type { OrchestrationContext, OrchestrationTurn } from '../types/conversation-orchestrator.types';

export const EVENT_ORCHESTRATOR_CREATED             = 'conversation.created'            as const;
export const EVENT_ORCHESTRATOR_STARTED             = 'conversation.started'            as const;
export const EVENT_ORCHESTRATOR_TURN_STARTED         = 'conversation.turn.started'         as const;
export const EVENT_ORCHESTRATOR_TURN_COMPLETED       = 'conversation.turn.completed'       as const;
export const EVENT_ORCHESTRATOR_INTERRUPTED          = 'conversation.interrupted'          as const;
export const EVENT_ORCHESTRATOR_RESUMED              = 'conversation.resumed'              as const;
export const EVENT_ORCHESTRATOR_CONTEXT_UPDATED      = 'conversation.context.updated'      as const;
export const EVENT_ORCHESTRATOR_RESPONSE_GENERATED  = 'conversation.response.generated'  as const;
export const EVENT_ORCHESTRATOR_COMPLETED            = 'conversation.completed'            as const;
export const EVENT_ORCHESTRATOR_FAILED               = 'conversation.failed'               as const;

export interface OrchestratorCreatedEvent {
  type: typeof EVENT_ORCHESTRATOR_CREATED;
  payload: {
    sessionId: string;
    tenantId: string;
    clinicId: string | null;
    conversationId: string;
    occurredAt: Date;
  };
}

export interface OrchestratorStartedEvent {
  type: typeof EVENT_ORCHESTRATOR_STARTED;
  payload: {
    sessionId: string;
    tenantId: string;
    occurredAt: Date;
  };
}

export interface OrchestratorTurnStartedEvent {
  type: typeof EVENT_ORCHESTRATOR_TURN_STARTED;
  payload: {
    sessionId: string;
    tenantId: string;
    turn: OrchestrationTurn;
    occurredAt: Date;
  };
}

export interface OrchestratorTurnCompletedEvent {
  type: typeof EVENT_ORCHESTRATOR_TURN_COMPLETED;
  payload: {
    sessionId: string;
    tenantId: string;
    turn: OrchestrationTurn;
    occurredAt: Date;
  };
}

export interface OrchestratorInterruptedEvent {
  type: typeof EVENT_ORCHESTRATOR_INTERRUPTED;
  payload: {
    sessionId: string;
    tenantId: string;
    audioOffsetMs: number;
    occurredAt: Date;
  };
}

export interface OrchestratorResumedEvent {
  type: typeof EVENT_ORCHESTRATOR_RESUMED;
  payload: {
    sessionId: string;
    tenantId: string;
    occurredAt: Date;
  };
}

export interface OrchestratorContextUpdatedEvent {
  type: typeof EVENT_ORCHESTRATOR_CONTEXT_UPDATED;
  payload: {
    sessionId: string;
    tenantId: string;
    context: OrchestrationContext;
    occurredAt: Date;
  };
}

export interface OrchestratorResponseGeneratedEvent {
  type: typeof EVENT_ORCHESTRATOR_RESPONSE_GENERATED;
  payload: {
    sessionId: string;
    tenantId: string;
    text: string;
    occurredAt: Date;
  };
}

export interface OrchestratorCompletedEvent {
  type: typeof EVENT_ORCHESTRATOR_COMPLETED;
  payload: {
    sessionId: string;
    tenantId: string;
    durationMs: number;
    occurredAt: Date;
  };
}

export interface OrchestratorFailedEvent {
  type: typeof EVENT_ORCHESTRATOR_FAILED;
  payload: {
    sessionId: string;
    tenantId: string;
    errorCode: string;
    errorMessage: string;
    occurredAt: Date;
  };
}

export type OrchestratorDomainEvent =
  | OrchestratorCreatedEvent
  | OrchestratorStartedEvent
  | OrchestratorTurnStartedEvent
  | OrchestratorTurnCompletedEvent
  | OrchestratorInterruptedEvent
  | OrchestratorResumedEvent
  | OrchestratorContextUpdatedEvent
  | OrchestratorResponseGeneratedEvent
  | OrchestratorCompletedEvent
  | OrchestratorFailedEvent;

export interface IOrchestratorEventPublisher {
  publish(event: OrchestratorDomainEvent): Promise<void>;
  subscribe(
    eventType: OrchestratorDomainEvent['type'],
    handler: (event: OrchestratorDomainEvent) => void | Promise<void>
  ): void;
}

/**
 * Prompt Engine Domain Events
 */

import type {
  EVENT_PROMPT_CREATED,
  EVENT_PROMPT_UPDATED,
  EVENT_PROMPT_PUBLISHED,
  EVENT_PROMPT_ARCHIVED,
  EVENT_PROMPT_ROLLED_BACK,
  EVENT_PROMPT_COMPOSE_REQUESTED,
  EVENT_PROMPT_VALIDATION_FAILED,
  EVENT_PROMPT_CACHE_INVALIDATED,
} from '../constants/prompt-engine.constants';

export interface PromptCreatedEvent {
  type: typeof EVENT_PROMPT_CREATED;
  payload: {
    tenantId: string;
    clinicId: string | null;
    promptId: string;
    promptType: string;
    promptVersion: number;
    actorId: string;
    requestId: string;
    occurredAt: Date;
  };
}

export interface PromptUpdatedEvent {
  type: typeof EVENT_PROMPT_UPDATED;
  payload: {
    tenantId: string;
    clinicId: string | null;
    promptId: string;
    promptType: string;
    promptVersion: number;
    actorId: string;
    requestId: string;
    occurredAt: Date;
  };
}

export interface PromptPublishedEvent {
  type: typeof EVENT_PROMPT_PUBLISHED;
  payload: {
    tenantId: string;
    clinicId: string | null;
    promptId: string;
    promptType: string;
    promptVersion: number;
    actorId: string;
    requestId: string;
    occurredAt: Date;
  };
}

export interface PromptArchivedEvent {
  type: typeof EVENT_PROMPT_ARCHIVED;
  payload: {
    tenantId: string;
    clinicId: string | null;
    promptId: string;
    promptType: string;
    promptVersion: number;
    actorId: string;
    requestId: string;
    occurredAt: Date;
  };
}

export interface PromptRolledBackEvent {
  type: typeof EVENT_PROMPT_ROLLED_BACK;
  payload: {
    tenantId: string;
    clinicId: string | null;
    promptId: string;
    promptType: string;
    newVersion: number;
    rolledBackFromVersion: number;
    actorId: string;
    requestId: string;
    occurredAt: Date;
  };
}

export interface PromptComposeRequestedEvent {
  type: typeof EVENT_PROMPT_COMPOSE_REQUESTED;
  payload: {
    tenantId: string;
    clinicId: string | null;
    promptId: string | null;
    promptVersion: number | null;
    requestId: string;
    occurredAt: Date;
  };
}

export interface PromptValidationFailedEvent {
  type: typeof EVENT_PROMPT_VALIDATION_FAILED;
  payload: {
    tenantId: string;
    clinicId: string | null;
    promptId: string;
    promptType: string;
    errors: Array<{ code: string; message: string }>;
    actorId: string;
    requestId: string;
    occurredAt: Date;
  };
}

export interface PromptCacheInvalidatedEvent {
  type: typeof EVENT_PROMPT_CACHE_INVALIDATED;
  payload: {
    tenantId: string;
    clinicId: string | null;
    promptType: string;
    occurredAt: Date;
  };
}

export type PromptEngineDomainEvent =
  | PromptCreatedEvent
  | PromptUpdatedEvent
  | PromptPublishedEvent
  | PromptArchivedEvent
  | PromptRolledBackEvent
  | PromptComposeRequestedEvent
  | PromptValidationFailedEvent
  | PromptCacheInvalidatedEvent;

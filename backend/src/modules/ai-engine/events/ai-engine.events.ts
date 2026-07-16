/**
 * AI Engine Domain Events
 */

import type {
  EVENT_AI_SESSION_STARTED,
  EVENT_AI_SESSION_COMPLETED,
  EVENT_AI_PROMPT_VERSION_USED,
  EVENT_AI_PROVIDER_CHANGED,
  EVENT_AI_FALLBACK_TRIGGERED,
  EVENT_AI_TOOL_REQUEST_GENERATED,
} from '../constants/ai-engine.constants';

export interface AiSessionStartedEvent {
  type: typeof EVENT_AI_SESSION_STARTED;
  payload: {
    tenantId: string;
    clinicId: string | null;
    conversationId: string;
    provider: string;
    requestId: string;
    occurredAt: Date;
  };
}

export interface AiSessionCompletedEvent {
  type: typeof EVENT_AI_SESSION_COMPLETED;
  payload: {
    tenantId: string;
    clinicId: string | null;
    conversationId: string;
    provider: string;
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    requestId: string;
    occurredAt: Date;
  };
}

export interface AiPromptVersionUsedEvent {
  type: typeof EVENT_AI_PROMPT_VERSION_USED;
  payload: {
    tenantId: string;
    clinicId: string | null;
    conversationId: string;
    promptVersion: number;
    requestId: string;
    occurredAt: Date;
  };
}

export interface AiProviderChangedEvent {
  type: typeof EVENT_AI_PROVIDER_CHANGED;
  payload: {
    tenantId: string;
    clinicId: string | null;
    conversationId: string;
    oldProvider: string;
    newProvider: string;
    requestId: string;
    occurredAt: Date;
  };
}

export interface AiFallbackTriggeredEvent {
  type: typeof EVENT_AI_FALLBACK_TRIGGERED;
  payload: {
    tenantId: string;
    clinicId: string | null;
    conversationId: string;
    reason: string;
    requestId: string;
    occurredAt: Date;
  };
}

export interface AiToolRequestGeneratedEvent {
  type: typeof EVENT_AI_TOOL_REQUEST_GENERATED;
  payload: {
    tenantId: string;
    clinicId: string | null;
    conversationId: string;
    toolName: string;
    requestId: string;
    occurredAt: Date;
  };
}

export type AiEngineDomainEvent =
  | AiSessionStartedEvent
  | AiSessionCompletedEvent
  | AiPromptVersionUsedEvent
  | AiProviderChangedEvent
  | AiFallbackTriggeredEvent
  | AiToolRequestGeneratedEvent;

import type { ToolRequest, ToolResult } from './ai-tool.types';

export const EVENT_TOOL_REQUESTED   = 'tool.requested'   as const;
export const EVENT_TOOL_VALIDATED   = 'tool.validated'   as const;
export const EVENT_TOOL_EXECUTED    = 'tool.executed'    as const;
export const EVENT_TOOL_FAILED      = 'tool.failed'      as const;
export const EVENT_TOOL_RETRIED     = 'tool.retried'     as const;
export const EVENT_TOOL_TIMEDOUT    = 'tool.timedout'    as const;
export const EVENT_TOOL_DENIED      = 'tool.denied'      as const;
export const EVENT_TOOL_COMPLETED   = 'tool.completed'   as const;

export interface ToolRequestedEvent {
  type: typeof EVENT_TOOL_REQUESTED;
  payload: {
    request: ToolRequest;
  };
}

export interface ToolValidatedEvent {
  type: typeof EVENT_TOOL_VALIDATED;
  payload: {
    request: ToolRequest;
  };
}

export interface ToolExecutedEvent {
  type: typeof EVENT_TOOL_EXECUTED;
  payload: {
    request: ToolRequest;
    latencyMs: number;
  };
}

export interface ToolFailedEvent {
  type: typeof EVENT_TOOL_FAILED;
  payload: {
    request: ToolRequest;
    error: {
      code: string;
      message: string;
      failureClass: string;
    };
  };
}

export interface ToolRetriedEvent {
  type: typeof EVENT_TOOL_RETRIED;
  payload: {
    request: ToolRequest;
    attemptCount: number;
  };
}

export interface ToolTimedOutEvent {
  type: typeof EVENT_TOOL_TIMEDOUT;
  payload: {
    request: ToolRequest;
    timeoutMs: number;
  };
}

export interface ToolDeniedEvent {
  type: typeof EVENT_TOOL_DENIED;
  payload: {
    request: ToolRequest;
    reason: string;
  };
}

export interface ToolCompletedEvent {
  type: typeof EVENT_TOOL_COMPLETED;
  payload: {
    request: ToolRequest;
    result: ToolResult;
  };
}

export type AiToolDomainEvent =
  | ToolRequestedEvent
  | ToolValidatedEvent
  | ToolExecutedEvent
  | ToolFailedEvent
  | ToolRetriedEvent
  | ToolTimedOutEvent
  | ToolDeniedEvent
  | ToolCompletedEvent;

export interface IAiToolEventPublisher {
  publish(event: AiToolDomainEvent): Promise<void>;
  subscribe(
    eventType: AiToolDomainEvent['type'],
    handler: (event: AiToolDomainEvent) => void | Promise<void>
  ): void;
}

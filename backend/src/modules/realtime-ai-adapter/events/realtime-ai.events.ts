/**
 * Realtime AI Domain Events
 */

import type { RealtimeProviderType } from '../constants/realtime-ai.constants';
import type { RealtimeToolCall, RealtimeTranscriptEvent, RealtimeInterruptionEvent } from '../types/realtime-ai.types';

export const EVENT_REALTIME_SESSION_CREATED        = 'realtime.session.created'        as const;
export const EVENT_REALTIME_SESSION_CONNECTED      = 'realtime.session.connected'      as const;
export const EVENT_REALTIME_SESSION_STREAMING      = 'realtime.session.streaming'      as const;
export const EVENT_REALTIME_SESSION_ENDED          = 'realtime.session.ended'          as const;
export const EVENT_REALTIME_SESSION_FAILED         = 'realtime.session.failed'         as const;
export const EVENT_REALTIME_TRANSCRIPT_GENERATED    = 'realtime.transcript.generated'    as const;
export const EVENT_REALTIME_TOOL_CALL_RECEIVED     = 'realtime.tool_call.received'     as const;
export const EVENT_REALTIME_INTERRUPTION_DETECTED  = 'realtime.interruption.detected'  as const;

export interface RealtimeSessionCreatedEvent {
  type: typeof EVENT_REALTIME_SESSION_CREATED;
  payload: {
    sessionId: string;
    tenantId: string;
    clinicId: string | null;
    conversationId: string;
    provider: RealtimeProviderType;
    occurredAt: Date;
  };
}

export interface RealtimeSessionConnectedEvent {
  type: typeof EVENT_REALTIME_SESSION_CONNECTED;
  payload: {
    sessionId: string;
    tenantId: string;
    occurredAt: Date;
  };
}

export interface RealtimeSessionStreamingEvent {
  type: typeof EVENT_REALTIME_SESSION_STREAMING;
  payload: {
    sessionId: string;
    tenantId: string;
    occurredAt: Date;
  };
}

export interface RealtimeSessionEndedEvent {
  type: typeof EVENT_REALTIME_SESSION_ENDED;
  payload: {
    sessionId: string;
    tenantId: string;
    durationMs: number;
    occurredAt: Date;
  };
}

export interface RealtimeSessionFailedEvent {
  type: typeof EVENT_REALTIME_SESSION_FAILED;
  payload: {
    sessionId: string;
    tenantId: string;
    errorCode: string;
    errorMessage: string;
    occurredAt: Date;
  };
}

export interface RealtimeTranscriptGeneratedEvent {
  type: typeof EVENT_REALTIME_TRANSCRIPT_GENERATED;
  payload: {
    sessionId: string;
    tenantId: string;
    event: RealtimeTranscriptEvent;
    occurredAt: Date;
  };
}

export interface RealtimeToolCallReceivedEvent {
  type: typeof EVENT_REALTIME_TOOL_CALL_RECEIVED;
  payload: {
    sessionId: string;
    tenantId: string;
    toolCalls: RealtimeToolCall[];
    occurredAt: Date;
  };
}

export interface RealtimeInterruptionDetectedEvent {
  type: typeof EVENT_REALTIME_INTERRUPTION_DETECTED;
  payload: {
    sessionId: string;
    tenantId: string;
    event: RealtimeInterruptionEvent;
    occurredAt: Date;
  };
}

export type RealtimeDomainEvent =
  | RealtimeSessionCreatedEvent
  | RealtimeSessionConnectedEvent
  | RealtimeSessionStreamingEvent
  | RealtimeSessionEndedEvent
  | RealtimeSessionFailedEvent
  | RealtimeTranscriptGeneratedEvent
  | RealtimeToolCallReceivedEvent
  | RealtimeInterruptionDetectedEvent;

export interface IRealtimeEventPublisher {
  publish(event: RealtimeDomainEvent): Promise<void>;
  subscribe(
    eventType: RealtimeDomainEvent['type'],
    handler: (event: RealtimeDomainEvent) => void | Promise<void>
  ): void;
}

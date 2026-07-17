/**
 * Twilio Voice Provider — Types
 */

import type { TwilioCallState } from './twilio.constants';

export interface TwilioMediaStreamStart {
  streamSid: string;
  callSid: string;
  accountSid: string;
  tracks: string[];
  customParameters?: Record<string, unknown>;
}

export interface TwilioMediaStreamPayload {
  event: 'connected' | 'start' | 'media' | 'stop' | 'mark';
  sequenceNumber?: string;
  streamSid?: string;
  start?: TwilioMediaStreamStart;
  media?: {
    track: 'inbound' | 'outbound';
    chunk: string;
    timestamp: string;
  };
  stop?: {
    callSid: string;
  };
  mark?: {
    name: string;
  };
}

export interface TwilioCallSession {
  sessionId: string;
  callSid: string;
  tenantId: string;
  clinicId: string | null;
  state: TwilioCallState;
  createdAt: number;
  updatedAt: number;
  endedAt: number | null;
  metadata: Record<string, unknown>;
}

export interface TwilioNormalizedEvent {
  type:
    | 'incoming.call'
    | 'call.answered'
    | 'call.ringing'
    | 'call.ended'
    | 'call.failed'
    | 'media.connected'
    | 'media.disconnected'
    | 'media.frame'
    | 'dtmf.received'
    | 'transfer.requested'
    | 'silence.detected';
  sessionId: string;
  timestamp: number;
  payload: Record<string, unknown>;
}

export interface TwilioMetricsSnapshot {
  activeCallsCount: number;
  completedCallsCount: number;
  failedCallsCount: number;
  totalCallsCount: number;
  reconnectAttemptsCount: number;
  webhookFailuresCount: number;
  mediaStreamFailuresCount: number;
  averageCallDurationMs: number;
  averageStreamLatencyMs: number;
  packetLossRate: number;
  dtmfCount: number;
  silenceCount: number;
}

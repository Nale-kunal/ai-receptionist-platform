/**
 * Twilio Voice Provider — Interfaces
 */

import type { AudioFrame } from '../../types/voice-server.types';
import type { TwilioNormalizedEvent } from './twilio.types';

export interface ITwilioSecurityValidator {
  validateSignature(url: string, params: Record<string, string>, signature: string): boolean;
  validateTimestamp(timestampStr: string): boolean;
  checkReplay(signature: string): boolean;
  validateFrameSize(bytes: number): void;
}

export interface ITwilioAudioStream {
  pushInbound(base64Payload: string, sequence: number, timestamp: number): Promise<AudioFrame>;
  popOutbound(sessionId: string): Promise<Buffer | null>;
  close(sessionId: string): void;
}

export interface ITwilioEventRouter {
  routeWebhook(callSid: string, body: Record<string, unknown>): Promise<TwilioNormalizedEvent>;
  routeMediaStream(streamSid: string, message: Record<string, unknown>): Promise<TwilioNormalizedEvent | null>;
}

// ---------------------------------------------------------------------------
// Call Transfer Interfaces (hooks only - no implementation)
// ---------------------------------------------------------------------------

export interface ITwilioCallTransfer {
  warmTransfer(sessionId: string, targetNumber: string, metadata?: Record<string, unknown>): Promise<void>;
  coldTransfer(sessionId: string, targetNumber: string): Promise<void>;
  transferToVoicemail(sessionId: string, voicemailBoxId: string): Promise<void>;
  transferToConference(sessionId: string, roomName: string): Promise<void>;
  parkCall(sessionId: string, parkingLotId: string): Promise<void>;
}

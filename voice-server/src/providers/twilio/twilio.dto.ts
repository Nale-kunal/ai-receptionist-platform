/**
 * Twilio Voice Provider — DTOs
 */

export interface TwilioInboundCallDto {
  CallSid: string;
  AccountSid: string;
  From: string;
  To: string;
  CallStatus: 'ringing' | 'in-progress' | 'completed' | 'failed' | 'busy' | 'no-answer';
  Direction: 'inbound' | 'outbound-api' | 'outbound-dial';
  ApiVersion: string;
}

export interface TwilioCallStatusCallbackDto {
  CallSid: string;
  AccountSid: string;
  From: string;
  To: string;
  CallStatus: string;
  CallDuration?: string;
  SequenceNumber?: string;
}

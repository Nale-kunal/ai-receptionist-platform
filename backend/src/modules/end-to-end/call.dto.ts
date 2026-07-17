/**
 * End-to-End Call Flow — DTO Definitions
 */

export interface StartCallDto {
  tenantId: string;
  callerNumber: string;
  calledNumber: string;
  callSid: string;
}

export interface EndCallDto {
  sessionId: string;
  hangupReason?: string;
}

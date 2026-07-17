/**
 * End-to-End Call Flow — Domain Events
 */

export const E2E_EVENT_CALL_STARTED          = 'e2e.call.started'          as const;
export const E2E_EVENT_GREETING_DELIVERED     = 'e2e.greeting.delivered'     as const;
export const E2E_EVENT_USER_SPEECH_RECEIVED  = 'e2e.user.speech_received'  as const;
export const E2E_EVENT_AI_REPLIED            = 'e2e.ai.replied'            as const;
export const E2E_EVENT_TOOL_EXECUTED         = 'e2e.tool.executed'         as const;
export const E2E_EVENT_INTERRUPTION_OCCURRED = 'e2e.interruption.occurred' as const;
export const E2E_EVENT_CALL_COMPLETED        = 'e2e.call.completed'        as const;
export const E2E_EVENT_CALL_FAILED           = 'e2e.call.failed'           as const;

export interface E2eEventEnvelope {
  type: string;
  sessionId: string;
  timestamp: Date;
  correlationId: string;
  payload: Record<string, unknown>;
}

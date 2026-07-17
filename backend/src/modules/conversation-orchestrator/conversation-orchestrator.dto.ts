import type { SafeOrchestrationSession } from './conversation-orchestrator.types';

export interface CreateConversationSessionRequest {
  clinicId: string | null;
  conversationId: string;
  metadata?: Record<string, unknown>;
}

export interface ConversationSessionResponse {
  success: boolean;
  data: {
    session: SafeOrchestrationSession;
  };
}

export interface ConversationSessionsListResponse {
  success: boolean;
  data: {
    sessions: SafeOrchestrationSession[];
  };
}

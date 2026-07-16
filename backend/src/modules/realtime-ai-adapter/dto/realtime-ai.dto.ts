import type { SafeRealtimeSession } from '../types/realtime-ai.types';

export interface CreateRealtimeSessionRequest {
  clinicId: string | null;
  conversationId: string;
  provider: 'openai' | 'gemini' | 'mock';
  providerSessionId: string;
  metadata?: Record<string, unknown>;
}

export interface RealtimeSessionResponse {
  success: boolean;
  data: {
    session: SafeRealtimeSession;
  };
}

export interface RealtimeSessionsListResponse {
  success: boolean;
  data: {
    sessions: SafeRealtimeSession[];
  };
}

import type {
  SafeRealtimeSession,
  RealtimeAudioFrame,
  RealtimeTranscriptEvent,
  RealtimeToolCallEvent,
  RealtimeInterruptionEvent,
  RealtimeMetrics,
} from '../types/realtime-ai.types';
import type { RealtimeProviderType, RealtimeSessionState } from '../constants/realtime-ai.constants';

export interface IRealtimeSessionManager {
  createSession(params: {
    tenantId: string;
    clinicId: string | null;
    conversationId: string;
    provider: RealtimeProviderType;
    providerSessionId: string;
    metadata?: Record<string, unknown>;
  }): Promise<SafeRealtimeSession>;

  getSession(sessionId: string, tenantId: string): Promise<SafeRealtimeSession>;
  updateSessionState(sessionId: string, tenantId: string, state: RealtimeSessionState): Promise<SafeRealtimeSession>;
  endSession(sessionId: string, tenantId: string, error?: { code: string; message: string }): Promise<SafeRealtimeSession>;
  listActiveSessions(tenantId: string): Promise<SafeRealtimeSession[]>;
  rateLimitCheck(tenantId: string): boolean;
}

export interface IRealtimeAiProvider {
  readonly providerName: RealtimeProviderType;
  connect(sessionId: string, apiKey: string): Promise<void>;
  disconnect(sessionId: string): Promise<void>;
  createSession(sessionId: string, config: Record<string, unknown>): Promise<void>;
  closeSession(sessionId: string): Promise<void>;
  sendAudio(sessionId: string, frame: RealtimeAudioFrame): Promise<void>;
  receiveAudio(sessionId: string): AsyncIterable<RealtimeAudioFrame>;
  sendText(sessionId: string, text: string): Promise<void>;
  receiveEvents(sessionId: string): AsyncIterable<Record<string, unknown>>;
  updateSession(sessionId: string, config: Record<string, unknown>): Promise<void>;
  heartbeat(sessionId: string): Promise<void>;
  connectionStatus(sessionId: string): 'connected' | 'connecting' | 'disconnected';
}

export interface IRealtimeAiProviderFactory {
  getProvider(provider: RealtimeProviderType): IRealtimeAiProvider;
}

export interface IRealtimeEventRouter {
  routeTranscript(sessionId: string, event: RealtimeTranscriptEvent): Promise<void>;
  routeToolCall(sessionId: string, event: RealtimeToolCallEvent): Promise<void>;
  routeInterruption(sessionId: string, event: RealtimeInterruptionEvent): Promise<void>;
  routeAudioFrame(sessionId: string, frame: RealtimeAudioFrame): Promise<void>;
  routeError(sessionId: string, error: Error): Promise<void>;
}

export interface IRealtimeMetricsCollector {
  trackSessionStart(tenantId: string): void;
  trackSessionEnd(tenantId: string, durationMs: number): void;
  trackTokens(tenantId: string, inputTokens: number, outputTokens: number): void;
  trackResponseTime(tenantId: string, latencyMs: number): void;
  trackReconnect(): void;
  trackConnectionFailure(): void;
  getMetrics(): RealtimeMetrics;
}

export interface IRealtimeAuditLogger {
  logSessionCreated(sessionId: string, tenantId: string, provider: string, conversationId: string): Promise<void>;
  logSessionClosed(sessionId: string, tenantId: string, conversationId: string): Promise<void>;
  logProviderError(sessionId: string, tenantId: string, conversationId: string, code: string, message: string): Promise<void>;
  logReconnectAttempt(sessionId: string, tenantId: string, conversationId: string, attempt: number): Promise<void>;
  logToolRequestReceived(sessionId: string, tenantId: string, conversationId: string, toolCallId: string, toolName: string): Promise<void>;
  logConfigurationLoaded(sessionId: string, tenantId: string, conversationId: string): Promise<void>;
  logPromptVersionUsed(sessionId: string, tenantId: string, conversationId: string, promptId: string, version: number): Promise<void>;
}

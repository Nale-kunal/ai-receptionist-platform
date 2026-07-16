import type {
  SafeVoiceSession,
  VoiceSessionState,
  VoiceSessionStreamState,
  AudioFrame,
  VoiceMetrics,
} from '../types/voice-server.types';
import type { VoiceServerConfig } from '../config/voice-server.config';

export interface IVoiceSessionManager {
  createSession(params: {
    tenantId: string;
    clinicId: string | null;
    provider: string;
    providerCallId: string;
    metadata?: Record<string, unknown>;
  }): Promise<SafeVoiceSession>;

  getSession(sessionId: string, tenantId: string): Promise<SafeVoiceSession>;
  updateSessionState(sessionId: string, tenantId: string, state: VoiceSessionState): Promise<SafeVoiceSession>;
  updateStreamState(sessionId: string, tenantId: string, state: VoiceSessionStreamState): Promise<SafeVoiceSession>;
  endSession(sessionId: string, tenantId: string, error?: { code: string; message: string }): Promise<SafeVoiceSession>;
  listActiveSessions(tenantId: string): Promise<SafeVoiceSession[]>;
  rateLimitCheck(tenantId: string): boolean;
}

export interface IVoiceProvider {
  readonly providerName: string;
  createSession(sessionId: string, metadata: Record<string, unknown>): Promise<void>;
  closeSession(sessionId: string, reason?: string): Promise<void>;
  receiveAudio(sessionId: string): AsyncIterable<AudioFrame>;
  sendAudio(sessionId: string, frame: AudioFrame): Promise<void>;
  receiveEvents(sessionId: string): AsyncIterable<Record<string, unknown>>;
  heartbeat(sessionId: string): Promise<void>;
  connectionStatus(sessionId: string): 'connected' | 'reconnecting' | 'disconnected';
}

export interface IMediaPipeline {
  processInboundFrame(sessionId: string, rawPayload: Buffer, sequence: number): Promise<AudioFrame>;
  processOutboundFrame(sessionId: string, rawPayload: Buffer, sequence: number): Promise<AudioFrame>;
  getJitterDelayMs(): number;
  getDroppedFramesCount(): number;
  normalizeCodec(payload: Buffer, sourceCodec: string, targetCodec: string): Promise<Buffer>;
}

export interface IAudioBuffer {
  enqueue(frame: AudioFrame): void;
  dequeue(): AudioFrame | undefined;
  isEmpty(): boolean;
  isFull(): boolean;
  clear(): void;
  getUsageRatio(): number;
  getSize(): number;
  getCapacity(): number;
  onBackpressureRelease(callback: () => void): void;
}

export interface IVoiceConnectionManager {
  registerConnection(sessionId: string, socket: any): void;
  unregisterConnection(sessionId: string): void;
  ping(sessionId: string): void;
  handlePong(sessionId: string): void;
  getConnection(sessionId: string): any;
  shutdownGracefully(): Promise<void>;
}

export interface IVoiceMetricsCollector {
  trackSessionStart(tenantId: string): void;
  trackSessionEnd(tenantId: string, durationMs: number): void;
  trackDroppedFrame(): void;
  trackReconnect(): void;
  trackLatency(latencyMs: number): void;
  trackBufferUsage(usageRatio: number): void;
  trackConnectionFailure(): void;
  trackProviderFailure(): void;
  getMetrics(): VoiceMetrics;
}

export interface IVoiceAuditLogger {
  logSessionCreated(sessionId: string, tenantId: string, provider: string, callId: string): void;
  logSessionConnected(sessionId: string, tenantId: string): void;
  logSessionDisconnected(sessionId: string, tenantId: string, reason?: string): void;
  logProviderConnected(sessionId: string, tenantId: string, provider: string): void;
  logProviderDisconnected(sessionId: string, tenantId: string, provider: string, reason?: string): void;
  logError(sessionId: string, tenantId: string, code: string, message: string, details?: Record<string, unknown>): void;
  logTimeout(sessionId: string, tenantId: string, type: 'heartbeat' | 'idle'): void;
}

import type {
  SafeRealtimeSession,
  RealtimeSessionMetadata,
} from '../types/realtime-ai.types';
import type { RealtimeProviderType, RealtimeSessionState } from '../constants/realtime-ai.constants';
import { REALTIME_SESSION_STATE_CREATED } from '../constants/realtime-ai.constants';

export class RealtimeSessionModel {
  public readonly id: string; // Internal UUID
  public readonly publicId: string; // Exposed sessionId
  public readonly tenantId: string;
  public readonly clinicId: string | null;
  public readonly conversationId: string;
  public readonly provider: RealtimeProviderType;
  public readonly providerSessionId: string;
  public readonly connectionState: RealtimeSessionState;
  public readonly createdAt: Date;
  public readonly updatedAt: Date;
  public readonly endedAt: Date | null;
  public readonly metadata: RealtimeSessionMetadata;

  constructor(params: {
    id: string;
    publicId: string;
    tenantId: string;
    clinicId: string | null;
    conversationId: string;
    provider: RealtimeProviderType;
    providerSessionId: string;
    connectionState?: RealtimeSessionState;
    createdAt?: Date;
    updatedAt?: Date;
    endedAt?: Date | null;
    metadata?: RealtimeSessionMetadata;
  }) {
    this.id = params.id;
    this.publicId = params.publicId;
    this.tenantId = params.tenantId;
    this.clinicId = params.clinicId;
    this.conversationId = params.conversationId;
    this.provider = params.provider;
    this.providerSessionId = params.providerSessionId;
    this.connectionState = params.connectionState ?? REALTIME_SESSION_STATE_CREATED;
    this.createdAt = params.createdAt ?? new Date();
    this.updatedAt = params.updatedAt ?? new Date();
    this.endedAt = params.endedAt ?? null;
    this.metadata = params.metadata ?? {};
  }

  public copyWith(params: Partial<{
    connectionState: RealtimeSessionState;
    endedAt: Date | null;
    metadata: RealtimeSessionMetadata;
    updatedAt: Date;
  }>): RealtimeSessionModel {
    return new RealtimeSessionModel({
      id: this.id,
      publicId: this.publicId,
      tenantId: this.tenantId,
      clinicId: this.clinicId,
      conversationId: this.conversationId,
      provider: this.provider,
      providerSessionId: this.providerSessionId,
      connectionState: params.connectionState !== undefined ? params.connectionState : this.connectionState,
      createdAt: this.createdAt,
      updatedAt: params.updatedAt !== undefined ? params.updatedAt : new Date(),
      endedAt: params.endedAt !== undefined ? params.endedAt : this.endedAt,
      metadata: params.metadata !== undefined ? { ...this.metadata, ...params.metadata } : this.metadata,
    });
  }

  public toSafeSession(): SafeRealtimeSession {
    return {
      sessionId: this.publicId,
      tenantId: this.tenantId,
      clinicId: this.clinicId,
      conversationId: this.conversationId,
      provider: this.provider,
      providerSessionId: this.providerSessionId,
      connectionState: this.connectionState,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      endedAt: this.endedAt,
      metadata: this.metadata,
    };
  }
}

import type {
  SafeVoiceSession,
  VoiceSessionState,
  VoiceSessionStreamState,
  VoiceSessionMetadata,
} from '../types/voice-server.types';
import { VOICE_SESSION_STATE_CREATED } from '../types/voice-server.types';

export class VoiceSessionModel {
  public readonly id: string; // Internal UUID
  public readonly publicId: string; // public exposed ID
  public readonly tenantId: string;
  public readonly clinicId: string | null;
  public readonly provider: string;
  public readonly providerCallId: string;
  public readonly connectionState: VoiceSessionState;
  public readonly streamState: VoiceSessionStreamState;
  public readonly createdAt: Date;
  public readonly updatedAt: Date;
  public readonly endedAt: Date | null;
  public readonly metadata: VoiceSessionMetadata;

  constructor(params: {
    id: string;
    publicId: string;
    tenantId: string;
    clinicId: string | null;
    provider: string;
    providerCallId: string;
    connectionState?: VoiceSessionState;
    streamState?: VoiceSessionStreamState;
    createdAt?: Date;
    updatedAt?: Date;
    endedAt?: Date | null;
    metadata?: VoiceSessionMetadata;
  }) {
    this.id = params.id;
    this.publicId = params.publicId;
    this.tenantId = params.tenantId;
    this.clinicId = params.clinicId;
    this.provider = params.provider;
    this.providerCallId = params.providerCallId;
    this.connectionState = params.connectionState ?? VOICE_SESSION_STATE_CREATED;
    this.streamState = params.streamState ?? 'idle';
    this.createdAt = params.createdAt ?? new Date();
    this.updatedAt = params.updatedAt ?? new Date();
    this.endedAt = params.endedAt ?? null;
    this.metadata = params.metadata ?? {};
  }

  /**
   * Immutably copies the model with new parameters
   */
  public copyWith(params: Partial<{
    connectionState: VoiceSessionState;
    streamState: VoiceSessionStreamState;
    endedAt: Date | null;
    metadata: VoiceSessionMetadata;
    updatedAt: Date;
  }>): VoiceSessionModel {
    return new VoiceSessionModel({
      id: this.id,
      publicId: this.publicId,
      tenantId: this.tenantId,
      clinicId: this.clinicId,
      provider: this.provider,
      providerCallId: this.providerCallId,
      connectionState: params.connectionState !== undefined ? params.connectionState : this.connectionState,
      streamState: params.streamState !== undefined ? params.streamState : this.streamState,
      createdAt: this.createdAt,
      updatedAt: params.updatedAt !== undefined ? params.updatedAt : new Date(),
      endedAt: params.endedAt !== undefined ? params.endedAt : this.endedAt,
      metadata: params.metadata !== undefined ? { ...this.metadata, ...params.metadata } : this.metadata,
    });
  }

  /**
   * Maps to SafeVoiceSession structure ensuring internal DB ID is never exposed
   */
  public toSafeSession(): SafeVoiceSession {
    return {
      sessionId: this.publicId, // Exposing only the public ID
      tenantId: this.tenantId,
      clinicId: this.clinicId,
      provider: this.provider,
      providerCallId: this.providerCallId,
      connectionState: this.connectionState,
      streamState: this.streamState,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      endedAt: this.endedAt,
      metadata: this.metadata,
    };
  }
}

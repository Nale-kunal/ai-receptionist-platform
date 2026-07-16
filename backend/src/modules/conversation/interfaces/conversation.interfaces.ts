/**
 * Conversation Module Interfaces & Contracts
 */

import type { ConversationStatus } from '../constants/conversation.constants';
import type { SafeConversation, TranscriptTurn, ConversationSummary } from '../types/conversation.types';

// ---------------------------------------------------------------------------
// Service Param Interfaces
// ---------------------------------------------------------------------------

export interface CreateConversationParams {
  tenantId: string;
  clinicId: string;
  patientId?: string | null;
  doctorId?: string | null;
  appointmentId?: string | null;
  callSessionId: string;
  callerPhone?: string | null;
  startedAt: Date;
  language?: string;
  source?: string;
  metadata?: Record<string, unknown> | null;

  actorId: string;
  requestId: string;
}

export interface UpdateConversationParams {
  id: string;
  tenantId: string;
  patientId?: string | null;
  doctorId?: string | null;
  appointmentId?: string | null;
  intent?: string | null;
  sentiment?: string | null;
  extractedEntities?: Record<string, unknown> | null;
  inputTokens?: number | null;
  outputTokens?: number | null;
  totalTokens?: number | null;
  estimatedCostUsd?: string | null;
  aiModel?: string | null;
  aiProvider?: string | null;
  metadata?: Record<string, unknown> | null;

  actorId: string;
  requestId: string;
}

export interface UpdateTranscriptParams {
  id: string;
  tenantId: string;
  turns: TranscriptTurn[];

  actorId: string;
  requestId: string;
}

export interface UpdateSummaryParams {
  id: string;
  tenantId: string;
  summary: ConversationSummary;

  actorId: string;
  requestId: string;
}

export interface LinkRecordingParams {
  id: string;
  tenantId: string;
  recordingReference: string;
  recordingProvider: string;
  recordingStatus: string;

  actorId: string;
  requestId: string;
}

export interface CompleteConversationParams {
  id: string;
  tenantId: string;
  endedAt?: Date;
  durationSeconds?: number | null;

  actorId: string;
  requestId: string;
}

export interface ListConversationsParams {
  tenantId: string;
  clinicId?: string;
  patientId?: string;
  doctorId?: string;
  appointmentId?: string;
  status?: ConversationStatus;
  intent?: string;
  language?: string;
  publicId?: string;
  callSessionId?: string;
  startedFrom?: Date;
  startedTo?: Date;
  limit?: number;
  offset?: number;
}

// ---------------------------------------------------------------------------
// Service Interface
// ---------------------------------------------------------------------------

export interface IConversationService {
  createConversation(params: CreateConversationParams): Promise<SafeConversation>;
  updateConversation(params: UpdateConversationParams): Promise<SafeConversation>;
  updateTranscript(params: UpdateTranscriptParams): Promise<SafeConversation>;
  updateSummary(params: UpdateSummaryParams): Promise<SafeConversation>;
  linkRecording(params: LinkRecordingParams): Promise<SafeConversation>;
  completeConversation(params: CompleteConversationParams): Promise<SafeConversation>;
  failConversation(id: string, tenantId: string, actorId: string, requestId: string): Promise<SafeConversation>;
  archiveConversation(id: string, tenantId: string, actorId: string, requestId: string): Promise<SafeConversation>;
  softDeleteConversation(id: string, tenantId: string, actorId: string, requestId: string): Promise<void>;
  getConversationById(id: string, tenantId: string): Promise<SafeConversation>;
  getConversationByPublicId(publicId: string, tenantId: string): Promise<SafeConversation>;
  listConversations(params: ListConversationsParams): Promise<SafeConversation[]>;
}

// ---------------------------------------------------------------------------
// Repository Interface
// ---------------------------------------------------------------------------

export interface IConversationRepository {
  create(data: {
    tenantId: string;
    clinicId: string;
    patientId?: string | null;
    doctorId?: string | null;
    appointmentId?: string | null;
    callSessionId: string;
    callerPhone?: string | null;
    startedAt: Date;
    status: ConversationStatus;
    language: string;
    metadata?: Record<string, unknown> | null;
  }): Promise<unknown>;

  update(
    id: string,
    data: {
      patientId?: string | null;
      doctorId?: string | null;
      appointmentId?: string | null;
      status?: ConversationStatus;
      endedAt?: Date | null;
      durationSeconds?: number | null;
      transcript?: TranscriptTurn[];
      transcriptVersion?: number;
      summary?: ConversationSummary | null;
      extractedEntities?: Record<string, unknown> | null;
      intent?: string | null;
      sentiment?: string | null;
      recordingReference?: string | null;
      recordingProvider?: string | null;
      recordingStatus?: string | null;
      inputTokens?: number | null;
      outputTokens?: number | null;
      totalTokens?: number | null;
      estimatedCostUsd?: string | null;
      aiModel?: string | null;
      aiProvider?: string | null;
      metadata?: Record<string, unknown> | null;
      deletedAt?: Date | null;
    },
  ): Promise<unknown>;

  findById(id: string, includeDeleted?: boolean): Promise<unknown | null>;
  findByPublicId(publicId: string, includeDeleted?: boolean): Promise<unknown | null>;

  findMany(params: {
    tenantId: string;
    clinicId?: string;
    patientId?: string;
    doctorId?: string;
    appointmentId?: string;
    status?: ConversationStatus;
    intent?: string;
    language?: string;
    publicId?: string;
    callSessionId?: string;
    startedFrom?: Date;
    startedTo?: Date;
    limit?: number;
    offset?: number;
    includeDeleted?: boolean;
  }): Promise<unknown[]>;

  /** Verify clinic belongs to tenant and is not suspended/deleted */
  clinicIsActive(clinicId: string, tenantId: string): Promise<boolean>;

  /** Verify patient belongs to clinic and tenant */
  patientBelongsToClinic(patientId: string, clinicId: string, tenantId: string): Promise<boolean>;

  /** Verify appointment belongs to clinic and tenant */
  appointmentBelongsToClinic(appointmentId: string, clinicId: string, tenantId: string): Promise<boolean>;
}

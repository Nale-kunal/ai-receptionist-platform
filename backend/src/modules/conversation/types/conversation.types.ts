/**
 * Conversation Module Types
 */

import type { ConversationStatus, RecordingStatus } from '../constants/conversation.constants';

// ---------------------------------------------------------------------------
// Transcript Turn
// ---------------------------------------------------------------------------

export interface TranscriptTurn {
  sequence: number;
  speaker: string;           // 'ai' | 'patient' | 'system'
  message: string;
  timestamp: string;         // ISO 8601
  language?: string;
  confidence?: number | null;
}

// ---------------------------------------------------------------------------
// AI Summary Structure
// ---------------------------------------------------------------------------

export interface ConversationSummary {
  text: string;
  primaryIntent?: string | null;
  outcome?: string | null;
  recommendedFollowUp?: string | null;
  actionItems?: string[];
  generatedAt: string;       // ISO 8601
  generatedByModel?: string | null;
}

// ---------------------------------------------------------------------------
// Recording Reference
// ---------------------------------------------------------------------------

export interface RecordingInfo {
  reference: string;
  provider: string;
  status: RecordingStatus;
}

// ---------------------------------------------------------------------------
// Safe (Output) Representation
// ---------------------------------------------------------------------------

export interface SafeConversation {
  id: string;
  publicId: string;
  tenantId: string;
  clinicId: string;
  patientId: string | null;
  doctorId: string | null;
  appointmentId: string | null;

  callSessionId: string;
  callerPhone: string | null;

  startedAt: Date;
  endedAt: Date | null;
  durationSeconds: number | null;

  status: ConversationStatus;
  language: string;

  transcript: TranscriptTurn[];
  transcriptVersion: number;

  summary: ConversationSummary | null;
  extractedEntities: Record<string, unknown> | null;
  intent: string | null;
  sentiment: string | null;

  recordingReference: string | null;
  recordingProvider: string | null;
  recordingStatus: string | null;

  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
  estimatedCostUsd: string | null;  // Decimal → string to avoid float precision issues
  aiModel: string | null;
  aiProvider: string | null;

  metadata: Record<string, unknown> | null;

  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

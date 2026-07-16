/**
 * Prompt Engine DTOs
 */

import type { SafePromptTemplate, ComposedPrompt } from '../types/prompt-engine.types';

// ---------------------------------------------------------------------------
// Request DTOs
// ---------------------------------------------------------------------------

export interface CreatePromptRequestDto {
  clinicId: string | null;
  promptType: string;
  content: string;
  variables: string[];
  changeSummary?: string;
}

export interface UpdatePromptRequestDto {
  content?: string;
  variables?: string[];
  changeSummary?: string;
}

export interface RollbackPromptRequestDto {
  targetVersionId: string;
}

export interface ComposeRequestDto {
  clinicId: string | null;
  variables: Record<string, string | undefined>;
  conversationContext?: string;
}

// ---------------------------------------------------------------------------
// Response DTOs
// ---------------------------------------------------------------------------

export interface PromptResponseDto {
  success: boolean;
  data: { prompt: SafePromptTemplate };
  requestId: string;
  timestamp: string;
}

export interface PromptListResponseDto {
  success: boolean;
  data: { prompts: SafePromptTemplate[]; total: number };
  requestId: string;
  timestamp: string;
}

export interface PromptHistoryResponseDto {
  success: boolean;
  data: { history: SafePromptTemplate[] };
  requestId: string;
  timestamp: string;
}

export interface ComposeResponseDto {
  success: boolean;
  data: { composed: ComposedPrompt };
  requestId: string;
  timestamp: string;
}

export interface AuditLogListResponseDto {
  success: boolean;
  data: { auditLogs: unknown[]; total: number };
  requestId: string;
  timestamp: string;
}

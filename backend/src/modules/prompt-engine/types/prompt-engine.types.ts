/**
 * Prompt Engine Type Definitions
 */

import type { PromptType, PromptStatus } from '../constants/prompt-engine.constants';

// ---------------------------------------------------------------------------
// Safe output representation (what crosses service/controller boundary)
// ---------------------------------------------------------------------------

export interface SafePromptTemplate {
  id: string;
  publicId: string;
  tenantId: string;
  clinicId: string | null;
  promptType: PromptType;
  version: number;
  status: PromptStatus;
  content: string;
  variables: string[];
  hash: string;
  changeSummary: string | null;
  authorId: string;
  publishedAt: Date | null;
  previousVersionId: string | null;
  rollbackFromVersion: number | null;
  createdAt: Date;
  updatedAt: Date;
}

// ---------------------------------------------------------------------------
// Composed prompt — the fully assembled final prompt string returned to AI Engine
// ---------------------------------------------------------------------------

export interface ComposedPrompt {
  /** The fully resolved, interpolated system prompt text */
  content: string;
  /** Prompt type that was composed (usually 'system') */
  promptType: PromptType;
  /** Version of the active prompt template used (null if using inline fallback) */
  promptVersion: number | null;
  /** Template ID used (null if using inline fallback) */
  promptId: string | null;
  /** Total character length of the composed prompt */
  characterCount: number;
}

// ---------------------------------------------------------------------------
// Variable map — caller supplies these values for interpolation
// ---------------------------------------------------------------------------

export interface PromptVariableMap {
  clinic_name?: string;
  timezone?: string;
  language?: string;
  business_hours?: string;
  doctor_list?: string;
  clinic_phone?: string;
  clinic_address?: string;
  clinic_email?: string;
  clinic_website?: string;
  today?: string;
  current_time?: string;
  tenant_name?: string;
  appointment_duration?: string;
  greeting_message?: string;
  supported_languages?: string;
  [key: string]: string | undefined;
}

// ---------------------------------------------------------------------------
// Compose context — everything the PromptComposerService needs
// ---------------------------------------------------------------------------

export interface PromptComposeContext {
  tenantId: string;
  clinicId: string | null;
  language: string;
  variables: PromptVariableMap;
  /** Resolved published prompt templates keyed by type */
  publishedPrompts: Partial<Record<PromptType, SafePromptTemplate>>;
  /** Conversation turns to append as context (optional) */
  conversationContext?: string;
}

// ---------------------------------------------------------------------------
// Prompt validation result
// ---------------------------------------------------------------------------

export interface PromptValidationResult {
  valid: boolean;
  errors: PromptValidationError[];
}

export interface PromptValidationError {
  code: string;
  message: string;
  variable?: string;
}

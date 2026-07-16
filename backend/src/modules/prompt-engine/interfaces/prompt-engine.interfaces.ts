/**
 * Prompt Engine Interfaces
 *
 * All cross-boundary contracts are defined here.
 * Services depend on interfaces, not concrete implementations.
 */

import type {
  SafePromptTemplate,
  ComposedPrompt,
  PromptVariableMap,
  PromptComposeContext,
  PromptValidationResult,
} from '../types/prompt-engine.types';
import type { PromptType, PromptStatus } from '../constants/prompt-engine.constants';
import type { PromptEngineDomainEvent } from '../events/prompt-engine.events';

// ---------------------------------------------------------------------------
// Main service interface — consumed by AI Engine and controllers
// ---------------------------------------------------------------------------

export interface IPromptEngineService {
  createPrompt(params: CreatePromptParams): Promise<SafePromptTemplate>;
  updatePrompt(params: UpdatePromptParams): Promise<SafePromptTemplate>;
  publishPrompt(id: string, tenantId: string, actorId: string, requestId: string): Promise<SafePromptTemplate>;
  archivePrompt(id: string, tenantId: string, actorId: string, requestId: string): Promise<SafePromptTemplate>;
  rollbackPrompt(params: RollbackPromptParams): Promise<SafePromptTemplate>;
  getPublishedPrompt(tenantId: string, clinicId: string | null, promptType: PromptType): Promise<SafePromptTemplate | null>;
  getPromptById(id: string, tenantId: string): Promise<SafePromptTemplate>;
  listPrompts(params: ListPromptsParams): Promise<SafePromptTemplate[]>;
  getPromptHistory(promptId: string, tenantId: string): Promise<SafePromptTemplate[]>;
  composeSystemPrompt(params: ComposeSystemPromptParams): Promise<ComposedPrompt>;
}

// ---------------------------------------------------------------------------
// Repository interface — Prisma-backed implementation
// ---------------------------------------------------------------------------

export interface IPromptTemplateRepository {
  create(data: CreatePromptData): Promise<unknown>;
  update(id: string, data: Partial<UpdatePromptData>): Promise<unknown>;
  findById(id: string): Promise<unknown | null>;
  findPublished(tenantId: string, clinicId: string | null, promptType: PromptType): Promise<unknown | null>;
  findMany(params: {
    tenantId: string;
    clinicId?: string | null;
    promptType?: PromptType;
    status?: PromptStatus;
    limit?: number;
    offset?: number;
  }): Promise<unknown[]>;
  findLatestVersion(tenantId: string, clinicId: string | null, promptType: PromptType): Promise<number>;
  archivePublished(tenantId: string, clinicId: string | null, promptType: PromptType): Promise<void>;
  findHistory(promptId: string, tenantId: string): Promise<unknown[]>;
}

// ---------------------------------------------------------------------------
// Audit log repository
// ---------------------------------------------------------------------------

export interface IPromptAuditLogRepository {
  create(data: {
    tenantId: string;
    clinicId: string | null;
    promptId: string;
    promptType: string;
    promptVersion: number;
    eventType: string;
    actorId: string;
    requestId: string | null;
    metadata?: Record<string, unknown> | null;
  }): Promise<unknown>;

  findMany(params: {
    tenantId: string;
    clinicId?: string | null;
    promptId?: string;
    limit?: number;
    offset?: number;
  }): Promise<unknown[]>;
}

// ---------------------------------------------------------------------------
// Event publisher interface
// ---------------------------------------------------------------------------

export interface IPromptEngineEventPublisher {
  publish(event: PromptEngineDomainEvent): Promise<void>;
}

// ---------------------------------------------------------------------------
// Cache interface
// ---------------------------------------------------------------------------

export interface IPromptCacheService {
  get(key: string): SafePromptTemplate | undefined;
  set(key: string, value: SafePromptTemplate): void;
  invalidate(key: string): void;
  buildKey(tenantId: string, clinicId: string | null, promptType: PromptType): string;
}

// ---------------------------------------------------------------------------
// Parameter types
// ---------------------------------------------------------------------------

export interface CreatePromptParams {
  tenantId: string;
  clinicId: string | null;
  promptType: PromptType;
  content: string;
  variables: string[];
  changeSummary?: string;
  authorId: string;
  requestId: string;
}

export interface UpdatePromptParams {
  id: string;
  tenantId: string;
  content?: string;
  variables?: string[];
  changeSummary?: string;
  actorId: string;
  requestId: string;
}

export interface RollbackPromptParams {
  targetVersionId: string;
  tenantId: string;
  actorId: string;
  requestId: string;
}

export interface ListPromptsParams {
  tenantId: string;
  clinicId?: string | null;
  promptType?: PromptType;
  status?: PromptStatus;
  limit?: number;
  offset?: number;
}

export interface ComposeSystemPromptParams {
  tenantId: string;
  clinicId: string | null;
  variables: PromptVariableMap;
  conversationContext?: string;
  requestId: string;
}

// ---------------------------------------------------------------------------
// Internal repository data types
// ---------------------------------------------------------------------------

export interface CreatePromptData {
  tenantId: string;
  clinicId: string | null;
  promptType: string;
  version: number;
  status: string;
  content: string;
  variables: unknown;
  hash: string;
  changeSummary: string | null;
  authorId: string;
  previousVersionId: string | null;
  rollbackFromVersion: number | null;
}

export interface UpdatePromptData {
  content: string;
  variables: unknown;
  hash: string;
  changeSummary: string | null;
  status: string;
  publishedAt: Date | null;
}

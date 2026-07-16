/**
 * Prompt Engine Service
 *
 * Main orchestrator for the Prompt Engine module.
 * Manages the full lifecycle: create → update → publish → archive → rollback.
 * Serves composed system prompts to the AI Engine.
 */

import { createHash } from 'crypto';
import type {
  IPromptEngineService,
  IPromptTemplateRepository,
  IPromptAuditLogRepository,
  IPromptEngineEventPublisher,
  IPromptCacheService,
  CreatePromptParams,
  UpdatePromptParams,
  RollbackPromptParams,
  ListPromptsParams,
  ComposeSystemPromptParams,
} from '../interfaces/prompt-engine.interfaces';
import type { SafePromptTemplate, ComposedPrompt } from '../types/prompt-engine.types';
import type { PromptComposerService } from './prompt-composer.service';
import type { PromptVariableResolverService } from './prompt-variable-resolver.service';
import {
  PROMPT_STATUS_DRAFT,
  PROMPT_STATUS_PUBLISHED,
  PROMPT_STATUS_ARCHIVED,
  PROMPT_TYPE_SYSTEM,
  PROMPT_TYPE_FAQ,
  PROMPT_TYPE_EMERGENCY,
  EVENT_PROMPT_CREATED,
  EVENT_PROMPT_UPDATED,
  EVENT_PROMPT_PUBLISHED,
  EVENT_PROMPT_ARCHIVED,
  EVENT_PROMPT_ROLLED_BACK,
  EVENT_PROMPT_COMPOSE_REQUESTED,
  EVENT_PROMPT_VALIDATION_FAILED,
  EVENT_PROMPT_CACHE_INVALIDATED,
} from '../constants/prompt-engine.constants';
import type { PromptType } from '../constants/prompt-engine.constants';
import {
  PromptNotFoundError,
  PromptIsolationViolationError,
  PromptValidationFailedError,
  PromptNotPublishableError,
  PromptNotArchivableError,
  PromptRollbackError,
} from '../errors/prompt-engine.errors';

export class PromptEngineService implements IPromptEngineService {
  constructor(
    private readonly promptRepo: IPromptTemplateRepository,
    private readonly auditRepo: IPromptAuditLogRepository,
    private readonly cache: IPromptCacheService,
    private readonly publisher: IPromptEngineEventPublisher,
    private readonly composer: PromptComposerService,
    private readonly resolver: PromptVariableResolverService,
  ) {}

  // ---------------------------------------------------------------------------
  // CREATE
  // ---------------------------------------------------------------------------

  public async createPrompt(params: CreatePromptParams): Promise<SafePromptTemplate> {
    const {
      tenantId, clinicId, promptType, content, variables,
      changeSummary, authorId, requestId,
    } = params;

    const version = (await this.promptRepo.findLatestVersion(tenantId, clinicId, promptType)) + 1;
    const hash = this.hashContent(content);

    const raw = await this.promptRepo.create({
      tenantId,
      clinicId,
      promptType,
      version,
      status: PROMPT_STATUS_DRAFT,
      content,
      variables,
      hash,
      changeSummary:  changeSummary ?? null,
      authorId,
      previousVersionId:   null,
      rollbackFromVersion: null,
    });

    const safe = this.mapToSafe(raw);

    await this.logAudit({
      tenantId, clinicId, promptId: safe.id, promptType, promptVersion: version,
      eventType: EVENT_PROMPT_CREATED, actorId: authorId, requestId,
    });
    await this.publisher.publish({
      type: EVENT_PROMPT_CREATED,
      payload: { tenantId, clinicId, promptId: safe.id, promptType, promptVersion: version, actorId: authorId, requestId, occurredAt: new Date() },
    });

    return safe;
  }

  // ---------------------------------------------------------------------------
  // UPDATE (creates a new draft — preserves history)
  // ---------------------------------------------------------------------------

  public async updatePrompt(params: UpdatePromptParams): Promise<SafePromptTemplate> {
    const { id, tenantId, content, variables, changeSummary, actorId, requestId } = params;

    const existing = await this.requirePrompt(id, tenantId);

    const updates: Record<string, unknown> = {};
    if (content !== undefined) {
      updates.content   = content;
      updates.hash      = this.hashContent(content);
    }
    if (variables !== undefined) updates.variables = variables;
    if (changeSummary !== undefined) updates.changeSummary = changeSummary;

    const raw = await this.promptRepo.update(id, updates as any);
    const safe = this.mapToSafe(raw);

    await this.logAudit({
      tenantId, clinicId: existing.clinicId, promptId: id, promptType: existing.promptType,
      promptVersion: existing.version, eventType: EVENT_PROMPT_UPDATED, actorId, requestId,
    });
    await this.publisher.publish({
      type: EVENT_PROMPT_UPDATED,
      payload: { tenantId, clinicId: existing.clinicId, promptId: id, promptType: existing.promptType, promptVersion: existing.version, actorId, requestId, occurredAt: new Date() },
    });

    return safe;
  }

  // ---------------------------------------------------------------------------
  // PUBLISH
  // ---------------------------------------------------------------------------

  public async publishPrompt(
    id: string,
    tenantId: string,
    actorId: string,
    requestId: string,
  ): Promise<SafePromptTemplate> {
    const existing = await this.requirePrompt(id, tenantId);

    if (existing.status !== PROMPT_STATUS_DRAFT) {
      throw new PromptNotPublishableError(existing.status);
    }

    // Pre-publish validation
    const validation = this.resolver.validate(existing.content, existing.variables);
    if (!validation.valid) {
      await this.logAudit({
        tenantId, clinicId: existing.clinicId, promptId: id, promptType: existing.promptType,
        promptVersion: existing.version, eventType: EVENT_PROMPT_VALIDATION_FAILED, actorId, requestId,
        metadata: { errors: validation.errors },
      });
      await this.publisher.publish({
        type: EVENT_PROMPT_VALIDATION_FAILED,
        payload: {
          tenantId, clinicId: existing.clinicId, promptId: id, promptType: existing.promptType,
          errors: validation.errors, actorId, requestId, occurredAt: new Date(),
        },
      });
      throw new PromptValidationFailedError(validation.errors);
    }

    // Archive any currently-published prompt for this scope
    await this.promptRepo.archivePublished(tenantId, existing.clinicId, existing.promptType as PromptType);

    // Mark this prompt as published
    const publishedAt = new Date();
    const raw = await this.promptRepo.update(id, {
      status:      PROMPT_STATUS_PUBLISHED,
      publishedAt,
    });
    const safe = this.mapToSafe(raw);

    // Invalidate cache
    const cacheKey = this.cache.buildKey(tenantId, existing.clinicId, existing.promptType as PromptType);
    this.cache.invalidate(cacheKey);

    await this.publisher.publish({
      type: EVENT_PROMPT_CACHE_INVALIDATED,
      payload: { tenantId, clinicId: existing.clinicId, promptType: existing.promptType, occurredAt: new Date() },
    });

    await this.logAudit({
      tenantId, clinicId: existing.clinicId, promptId: id, promptType: existing.promptType,
      promptVersion: existing.version, eventType: EVENT_PROMPT_PUBLISHED, actorId, requestId,
      metadata: { publishedAt: publishedAt.toISOString() },
    });
    await this.publisher.publish({
      type: EVENT_PROMPT_PUBLISHED,
      payload: { tenantId, clinicId: existing.clinicId, promptId: id, promptType: existing.promptType, promptVersion: existing.version, actorId, requestId, occurredAt: new Date() },
    });

    return safe;
  }

  // ---------------------------------------------------------------------------
  // ARCHIVE
  // ---------------------------------------------------------------------------

  public async archivePrompt(
    id: string,
    tenantId: string,
    actorId: string,
    requestId: string,
  ): Promise<SafePromptTemplate> {
    const existing = await this.requirePrompt(id, tenantId);

    if (existing.status === PROMPT_STATUS_ARCHIVED) {
      throw new PromptNotArchivableError(existing.status);
    }

    const raw = await this.promptRepo.update(id, { status: PROMPT_STATUS_ARCHIVED });
    const safe = this.mapToSafe(raw);

    // Invalidate cache if this was the published version
    if (existing.status === PROMPT_STATUS_PUBLISHED) {
      const cacheKey = this.cache.buildKey(tenantId, existing.clinicId, existing.promptType as PromptType);
      this.cache.invalidate(cacheKey);
    }

    await this.logAudit({
      tenantId, clinicId: existing.clinicId, promptId: id, promptType: existing.promptType,
      promptVersion: existing.version, eventType: EVENT_PROMPT_ARCHIVED, actorId, requestId,
    });
    await this.publisher.publish({
      type: EVENT_PROMPT_ARCHIVED,
      payload: { tenantId, clinicId: existing.clinicId, promptId: id, promptType: existing.promptType, promptVersion: existing.version, actorId, requestId, occurredAt: new Date() },
    });

    return safe;
  }

  // ---------------------------------------------------------------------------
  // ROLLBACK — creates a new published version from historical content
  // ---------------------------------------------------------------------------

  public async rollbackPrompt(params: RollbackPromptParams): Promise<SafePromptTemplate> {
    const { targetVersionId, tenantId, actorId, requestId } = params;

    const target = await this.requirePrompt(targetVersionId, tenantId);

    if (target.status === PROMPT_STATUS_PUBLISHED) {
      throw new PromptRollbackError('Cannot roll back to a currently-published version.');
    }

    // Determine next version number
    const nextVersion = (await this.promptRepo.findLatestVersion(tenantId, target.clinicId, target.promptType as PromptType)) + 1;

    // Archive current published
    await this.promptRepo.archivePublished(tenantId, target.clinicId, target.promptType as PromptType);

    // Create new version from target content
    const publishedAt = new Date();
    const raw = await this.promptRepo.create({
      tenantId,
      clinicId:           target.clinicId,
      promptType:         target.promptType,
      version:            nextVersion,
      status:             PROMPT_STATUS_PUBLISHED,
      content:            target.content,
      variables:          target.variables,
      hash:               target.hash,
      changeSummary:      `Rollback from version ${target.version}`,
      authorId:           actorId,
      previousVersionId:  target.id,
      rollbackFromVersion: target.version,
    });
    // Set publishedAt immediately after create
    const updatedRaw = await this.promptRepo.update((raw as any).id, { status: PROMPT_STATUS_PUBLISHED, publishedAt });
    const safe = this.mapToSafe(updatedRaw);

    // Invalidate cache
    const cacheKey = this.cache.buildKey(tenantId, target.clinicId, target.promptType as PromptType);
    this.cache.invalidate(cacheKey);

    await this.logAudit({
      tenantId, clinicId: target.clinicId, promptId: safe.id, promptType: target.promptType,
      promptVersion: nextVersion, eventType: EVENT_PROMPT_ROLLED_BACK, actorId, requestId,
      metadata: { rolledBackFromVersion: target.version, newVersion: nextVersion },
    });
    await this.publisher.publish({
      type: EVENT_PROMPT_ROLLED_BACK,
      payload: {
        tenantId, clinicId: target.clinicId, promptId: safe.id, promptType: target.promptType,
        newVersion: nextVersion, rolledBackFromVersion: target.version, actorId, requestId, occurredAt: new Date(),
      },
    });

    return safe;
  }

  // ---------------------------------------------------------------------------
  // READS
  // ---------------------------------------------------------------------------

  public async getPublishedPrompt(
    tenantId: string,
    clinicId: string | null,
    promptType: PromptType,
  ): Promise<SafePromptTemplate | null> {
    const cacheKey = this.cache.buildKey(tenantId, clinicId, promptType);
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    // Try clinic-level first (clinic overrides tenant)
    let raw: unknown | null = null;
    if (clinicId !== null) {
      raw = await this.promptRepo.findPublished(tenantId, clinicId, promptType);
    }
    // Fall back to tenant-level
    if (!raw) {
      raw = await this.promptRepo.findPublished(tenantId, null, promptType);
    }
    if (!raw) return null;

    const safe = this.mapToSafe(raw);
    this.cache.set(cacheKey, safe);
    return safe;
  }

  public async getPromptById(id: string, tenantId: string): Promise<SafePromptTemplate> {
    return this.requirePrompt(id, tenantId);
  }

  public async listPrompts(params: ListPromptsParams): Promise<SafePromptTemplate[]> {
    const raws = await this.promptRepo.findMany({
      tenantId:   params.tenantId,
      clinicId:   params.clinicId,
      promptType: params.promptType,
      status:     params.status,
      limit:      params.limit  ?? 50,
      offset:     params.offset ?? 0,
    });
    return raws.map((r) => this.mapToSafe(r));
  }

  public async getPromptHistory(promptId: string, tenantId: string): Promise<SafePromptTemplate[]> {
    const raws = await this.promptRepo.findHistory(promptId, tenantId);
    return raws.map((r) => this.mapToSafe(r));
  }

  // ---------------------------------------------------------------------------
  // COMPOSE — returns fully assembled system prompt string
  // ---------------------------------------------------------------------------

  public async composeSystemPrompt(params: ComposeSystemPromptParams): Promise<ComposedPrompt> {
    const { tenantId, clinicId, variables, conversationContext, requestId } = params;

    // Resolve published prompts that the composer needs
    const [systemPrompt, faqPrompt, emergencyPrompt] = await Promise.all([
      this.getPublishedPrompt(tenantId, clinicId, PROMPT_TYPE_SYSTEM),
      this.getPublishedPrompt(tenantId, clinicId, PROMPT_TYPE_FAQ),
      this.getPublishedPrompt(tenantId, clinicId, PROMPT_TYPE_EMERGENCY),
    ]);

    const publishedPrompts: Parameters<typeof this.composer.compose>[0]['publishedPrompts'] = {};
    if (systemPrompt)    publishedPrompts[PROMPT_TYPE_SYSTEM]    = systemPrompt;
    if (faqPrompt)       publishedPrompts[PROMPT_TYPE_FAQ]       = faqPrompt;
    if (emergencyPrompt) publishedPrompts[PROMPT_TYPE_EMERGENCY] = emergencyPrompt;

    const language = variables.language ?? 'en';

    const composed = this.composer.compose({
      tenantId,
      clinicId,
      language,
      variables,
      publishedPrompts,
      conversationContext,
    });

    await this.publisher.publish({
      type: EVENT_PROMPT_COMPOSE_REQUESTED,
      payload: {
        tenantId,
        clinicId,
        promptId:      composed.promptId,
        promptVersion: composed.promptVersion,
        requestId,
        occurredAt: new Date(),
      },
    });

    return composed;
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private async requirePrompt(id: string, tenantId: string): Promise<SafePromptTemplate> {
    const raw = await this.promptRepo.findById(id);
    if (!raw) throw new PromptNotFoundError(id);
    const safe = this.mapToSafe(raw);
    if (safe.tenantId !== tenantId) throw new PromptIsolationViolationError();
    return safe;
  }

  private hashContent(content: string): string {
    return createHash('sha256').update(content, 'utf8').digest('hex');
  }

  private mapToSafe(raw: unknown): SafePromptTemplate {
    const r = raw as Record<string, any>;
    return {
      id:                  r.id,
      publicId:            r.publicId,
      tenantId:            r.tenantId,
      clinicId:            r.clinicId ?? null,
      promptType:          r.promptType as PromptType,
      version:             r.version,
      status:              r.status,
      content:             r.content,
      variables:           Array.isArray(r.variables) ? r.variables : [],
      hash:                r.hash,
      changeSummary:       r.changeSummary ?? null,
      authorId:            r.authorId,
      publishedAt:         r.publishedAt ?? null,
      previousVersionId:   r.previousVersionId ?? null,
      rollbackFromVersion: r.rollbackFromVersion ?? null,
      createdAt:           r.createdAt,
      updatedAt:           r.updatedAt,
    };
  }

  private async logAudit(data: {
    tenantId: string;
    clinicId: string | null;
    promptId: string;
    promptType: string;
    promptVersion: number;
    eventType: string;
    actorId: string;
    requestId: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    try {
      await this.auditRepo.create(data);
    } catch (err) {
      console.error('[PromptEngine] Failed to write audit log:', err);
    }
  }
}

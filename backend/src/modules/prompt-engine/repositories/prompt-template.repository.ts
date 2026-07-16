/**
 * Prompt Template Repository
 *
 * Prisma-backed persistence for PromptTemplate.
 * All queries are tenant-scoped for multi-tenant isolation.
 */

import type { PrismaClient } from '@prisma/client';
import { Prisma } from '@prisma/client';
import type { IPromptTemplateRepository, CreatePromptData, UpdatePromptData } from '../interfaces/prompt-engine.interfaces';
import type { PromptType, PromptStatus } from '../constants/prompt-engine.constants';
import { PROMPT_STATUS_PUBLISHED, PROMPT_STATUS_ARCHIVED } from '../constants/prompt-engine.constants';

export class PromptTemplateRepository implements IPromptTemplateRepository {
  constructor(private readonly prisma: PrismaClient) {}

  public async create(data: CreatePromptData): Promise<unknown> {
    return this.prisma.promptTemplate.create({
      data: {
        tenantId:           data.tenantId,
        clinicId:           data.clinicId,
        promptType:         data.promptType,
        version:            data.version,
        status:             data.status,
        content:            data.content,
        variables:          data.variables as Prisma.InputJsonValue,
        hash:               data.hash,
        changeSummary:      data.changeSummary,
        authorId:           data.authorId,
        previousVersionId:  data.previousVersionId,
        rollbackFromVersion: data.rollbackFromVersion,
      },
    });
  }

  public async update(id: string, data: Partial<UpdatePromptData>): Promise<unknown> {
    return this.prisma.promptTemplate.update({
      where: { id },
      data: {
        ...(data.content !== undefined    ? { content: data.content }       : {}),
        ...(data.variables !== undefined  ? { variables: data.variables as Prisma.InputJsonValue } : {}),
        ...(data.hash !== undefined       ? { hash: data.hash }             : {}),
        ...(data.changeSummary !== undefined ? { changeSummary: data.changeSummary } : {}),
        ...(data.status !== undefined     ? { status: data.status }         : {}),
        ...(data.publishedAt !== undefined ? { publishedAt: data.publishedAt } : {}),
      },
    });
  }

  public async findById(id: string): Promise<unknown | null> {
    return this.prisma.promptTemplate.findUnique({ where: { id } });
  }

  /**
   * Finds the active published prompt for a given (tenantId, clinicId, promptType).
   * If clinicId is provided but no clinic-specific published prompt exists,
   * this returns null (caller falls back to tenant-level).
   */
  public async findPublished(
    tenantId: string,
    clinicId: string | null,
    promptType: PromptType,
  ): Promise<unknown | null> {
    return this.prisma.promptTemplate.findFirst({
      where: {
        tenantId,
        clinicId,
        promptType,
        status: PROMPT_STATUS_PUBLISHED,
      },
      orderBy: { version: 'desc' },
    });
  }

  public async findMany(params: {
    tenantId: string;
    clinicId?: string | null;
    promptType?: PromptType;
    status?: PromptStatus;
    limit?: number;
    offset?: number;
  }): Promise<unknown[]> {
    return this.prisma.promptTemplate.findMany({
      where: {
        tenantId: params.tenantId,
        ...(params.clinicId !== undefined ? { clinicId: params.clinicId } : {}),
        ...(params.promptType             ? { promptType: params.promptType } : {}),
        ...(params.status                 ? { status: params.status } : {}),
      },
      orderBy: [{ promptType: 'asc' }, { version: 'desc' }],
      take: params.limit ?? 50,
      skip: params.offset ?? 0,
    });
  }

  public async findLatestVersion(
    tenantId: string,
    clinicId: string | null,
    promptType: PromptType,
  ): Promise<number> {
    const result = await this.prisma.promptTemplate.findFirst({
      where: { tenantId, clinicId, promptType },
      orderBy: { version: 'desc' },
      select: { version: true },
    });
    return result?.version ?? 0;
  }

  /**
   * Archives all currently-published prompts for (tenantId, clinicId, promptType).
   * Called before activating a new published version.
   */
  public async archivePublished(
    tenantId: string,
    clinicId: string | null,
    promptType: PromptType,
  ): Promise<void> {
    await this.prisma.promptTemplate.updateMany({
      where: { tenantId, clinicId, promptType, status: PROMPT_STATUS_PUBLISHED },
      data: { status: PROMPT_STATUS_ARCHIVED },
    });
  }

  /**
   * Returns all versions of the same logical prompt line
   * (all versions sharing the same tenantId + clinicId + promptType).
   */
  public async findHistory(promptId: string, tenantId: string): Promise<unknown[]> {
    // First resolve the prompt to get its type/clinic scope
    const prompt = await this.prisma.promptTemplate.findUnique({
      where: { id: promptId },
      select: { tenantId: true, clinicId: true, promptType: true },
    });
    if (!prompt || prompt.tenantId !== tenantId) {
      return [];
    }
    return this.prisma.promptTemplate.findMany({
      where: {
        tenantId: prompt.tenantId,
        clinicId: prompt.clinicId,
        promptType: prompt.promptType,
      },
      orderBy: { version: 'desc' },
    });
  }
}

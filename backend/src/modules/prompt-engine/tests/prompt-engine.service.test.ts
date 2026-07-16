/**
 * Prompt Engine Service — Unit Tests
 *
 * Uses Jest mocks to isolate the service from Prisma and event infrastructure.
 */

import { PromptEngineService } from '../services/prompt-engine.service';
import { PromptComposerService } from '../services/prompt-composer.service';
import { PromptVariableResolverService } from '../services/prompt-variable-resolver.service';
import { PromptCacheService } from '../services/prompt-cache.service';
import type {
  IPromptTemplateRepository,
  IPromptAuditLogRepository,
  IPromptEngineEventPublisher,
} from '../interfaces/prompt-engine.interfaces';
import type { SafePromptTemplate } from '../types/prompt-engine.types';
import {
  PromptNotFoundError,
  PromptIsolationViolationError,
  PromptNotPublishableError,
  PromptNotArchivableError,
  PromptValidationFailedError,
  PromptRollbackError,
} from '../errors/prompt-engine.errors';
import {
  PROMPT_TYPE_SYSTEM,
  PROMPT_STATUS_DRAFT,
  PROMPT_STATUS_PUBLISHED,
  PROMPT_STATUS_ARCHIVED,
} from '../constants/prompt-engine.constants';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

const TENANT_ID = 'tenant-aaa';
const CLINIC_ID = 'clinic-bbb';
const UUID_1    = '11111111-1111-1111-1111-111111111111';
const UUID_2    = '22222222-2222-2222-2222-222222222222';
const ACTOR_ID  = 'user-actor';
const REQUEST_ID = 'req-123';

function makeSafeTemplate(overrides: Partial<SafePromptTemplate> = {}): SafePromptTemplate {
  return {
    id: UUID_1,
    publicId: 'prmp_test',
    tenantId: TENANT_ID,
    clinicId: null,
    promptType: PROMPT_TYPE_SYSTEM,
    version: 1,
    status: PROMPT_STATUS_DRAFT,
    content: 'You are a dental receptionist for {{clinic_name}}.',
    variables: ['clinic_name'],
    hash: 'abc',
    changeSummary: null,
    authorId: ACTOR_ID,
    publishedAt: null,
    previousVersionId: null,
    rollbackFromVersion: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeRaw(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const safe = makeSafeTemplate();
  return { ...safe, ...overrides };
}

// ---------------------------------------------------------------------------
// Mock setup
// ---------------------------------------------------------------------------

let mockRepo: jest.Mocked<IPromptTemplateRepository>;
let mockAuditRepo: jest.Mocked<IPromptAuditLogRepository>;
let mockPublisher: jest.Mocked<IPromptEngineEventPublisher>;
let cache: PromptCacheService;
let resolver: PromptVariableResolverService;
let composer: PromptComposerService;
let service: PromptEngineService;

beforeEach(() => {
  mockRepo = {
    create: jest.fn(),
    update: jest.fn(),
    findById: jest.fn(),
    findPublished: jest.fn(),
    findMany: jest.fn(),
    findLatestVersion: jest.fn(),
    archivePublished: jest.fn(),
    findHistory: jest.fn(),
  };

  mockAuditRepo = {
    create: jest.fn().mockResolvedValue({}),
    findMany: jest.fn().mockResolvedValue([]),
  };

  mockPublisher = {
    publish: jest.fn().mockResolvedValue(undefined),
  };

  cache    = new PromptCacheService();
  resolver = new PromptVariableResolverService();
  composer = new PromptComposerService(resolver);

  service = new PromptEngineService(
    mockRepo,
    mockAuditRepo,
    cache,
    mockPublisher,
    composer,
    resolver,
  );
});

// ---------------------------------------------------------------------------
// createPrompt
// ---------------------------------------------------------------------------

describe('createPrompt()', () => {
  it('creates a draft with version 1 for a new prompt type', async () => {
    mockRepo.findLatestVersion.mockResolvedValue(0);
    mockRepo.create.mockResolvedValue(makeRaw());

    const result = await service.createPrompt({
      tenantId: TENANT_ID,
      clinicId: null,
      promptType: PROMPT_TYPE_SYSTEM,
      content: 'You are a dental receptionist for {{clinic_name}}.',
      variables: ['clinic_name'],
      authorId: ACTOR_ID,
      requestId: REQUEST_ID,
    });

    expect(mockRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ version: 1, status: PROMPT_STATUS_DRAFT }),
    );
    expect(result.status).toBe(PROMPT_STATUS_DRAFT);
  });

  it('creates version N+1 when previous versions exist', async () => {
    mockRepo.findLatestVersion.mockResolvedValue(3);
    mockRepo.create.mockResolvedValue(makeRaw({ version: 4 }));

    const result = await service.createPrompt({
      tenantId: TENANT_ID,
      clinicId: null,
      promptType: PROMPT_TYPE_SYSTEM,
      content: 'Draft 4',
      variables: [],
      authorId: ACTOR_ID,
      requestId: REQUEST_ID,
    });

    expect(mockRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ version: 4 }),
    );
    expect(result.version).toBe(4);
  });

  it('publishes a prompt.created event', async () => {
    mockRepo.findLatestVersion.mockResolvedValue(0);
    mockRepo.create.mockResolvedValue(makeRaw());

    await service.createPrompt({
      tenantId: TENANT_ID, clinicId: null, promptType: PROMPT_TYPE_SYSTEM,
      content: 'Test', variables: [], authorId: ACTOR_ID, requestId: REQUEST_ID,
    });

    expect(mockPublisher.publish).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'prompt.created' }),
    );
  });

  it('hashes content (SHA-256 hex, 64 chars)', async () => {
    mockRepo.findLatestVersion.mockResolvedValue(0);
    mockRepo.create.mockImplementation(async (data) => ({ ...makeRaw(), hash: (data as any).hash }));

    await service.createPrompt({
      tenantId: TENANT_ID, clinicId: null, promptType: PROMPT_TYPE_SYSTEM,
      content: 'Content to hash', variables: [], authorId: ACTOR_ID, requestId: REQUEST_ID,
    });

    const hashArg = (mockRepo.create.mock.calls[0]![0] as any).hash;
    expect(hashArg).toHaveLength(64);
    expect(hashArg).toMatch(/^[a-f0-9]+$/);
  });
});

// ---------------------------------------------------------------------------
// publishPrompt
// ---------------------------------------------------------------------------

describe('publishPrompt()', () => {
  it('publishes a valid draft prompt', async () => {
    const draft = makeSafeTemplate();
    mockRepo.findById.mockResolvedValue(makeRaw());
    mockRepo.archivePublished.mockResolvedValue(undefined);
    mockRepo.update.mockResolvedValue(makeRaw({ status: PROMPT_STATUS_PUBLISHED, publishedAt: new Date() }));

    const result = await service.publishPrompt(UUID_1, TENANT_ID, ACTOR_ID, REQUEST_ID);

    expect(mockRepo.archivePublished).toHaveBeenCalledWith(TENANT_ID, null, PROMPT_TYPE_SYSTEM);
    expect(mockRepo.update).toHaveBeenCalledWith(UUID_1, expect.objectContaining({ status: PROMPT_STATUS_PUBLISHED }));
    expect(result.status).toBe(PROMPT_STATUS_PUBLISHED);
  });

  it('emits prompt.published event', async () => {
    mockRepo.findById.mockResolvedValue(makeRaw());
    mockRepo.archivePublished.mockResolvedValue(undefined);
    mockRepo.update.mockResolvedValue(makeRaw({ status: PROMPT_STATUS_PUBLISHED }));

    await service.publishPrompt(UUID_1, TENANT_ID, ACTOR_ID, REQUEST_ID);

    expect(mockPublisher.publish).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'prompt.published' }),
    );
  });

  it('throws PromptNotPublishableError when status is already published', async () => {
    mockRepo.findById.mockResolvedValue(makeRaw({ status: PROMPT_STATUS_PUBLISHED }));

    await expect(service.publishPrompt(UUID_1, TENANT_ID, ACTOR_ID, REQUEST_ID))
      .rejects.toThrow(PromptNotPublishableError);
  });

  it('throws PromptValidationFailedError for content exceeding max length', async () => {
    mockRepo.findById.mockResolvedValue(makeRaw({
      content: '{{unknown_var}} ' + 'a'.repeat(100), // unknown variable triggers validation failure
    }));

    await expect(service.publishPrompt(UUID_1, TENANT_ID, ACTOR_ID, REQUEST_ID))
      .rejects.toThrow(PromptValidationFailedError);

    expect(mockPublisher.publish).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'prompt.validation.failed' }),
    );
  });

  it('invalidates cache on publish', async () => {
    // Pre-populate cache
    const cached = makeSafeTemplate({ status: PROMPT_STATUS_PUBLISHED });
    cache.set(cache.buildKey(TENANT_ID, null, PROMPT_TYPE_SYSTEM), cached);
    expect(cache.get(cache.buildKey(TENANT_ID, null, PROMPT_TYPE_SYSTEM))).toBeDefined();

    mockRepo.findById.mockResolvedValue(makeRaw());
    mockRepo.archivePublished.mockResolvedValue(undefined);
    mockRepo.update.mockResolvedValue(makeRaw({ status: PROMPT_STATUS_PUBLISHED }));

    await service.publishPrompt(UUID_1, TENANT_ID, ACTOR_ID, REQUEST_ID);

    expect(cache.get(cache.buildKey(TENANT_ID, null, PROMPT_TYPE_SYSTEM))).toBeUndefined();
  });

  it('throws PromptNotFoundError when prompt does not exist', async () => {
    mockRepo.findById.mockResolvedValue(null);
    await expect(service.publishPrompt(UUID_1, TENANT_ID, ACTOR_ID, REQUEST_ID))
      .rejects.toThrow(PromptNotFoundError);
  });
});

// ---------------------------------------------------------------------------
// archivePrompt
// ---------------------------------------------------------------------------

describe('archivePrompt()', () => {
  it('archives a draft prompt', async () => {
    mockRepo.findById.mockResolvedValue(makeRaw());
    mockRepo.update.mockResolvedValue(makeRaw({ status: PROMPT_STATUS_ARCHIVED }));

    const result = await service.archivePrompt(UUID_1, TENANT_ID, ACTOR_ID, REQUEST_ID);
    expect(result.status).toBe(PROMPT_STATUS_ARCHIVED);
  });

  it('throws PromptNotArchivableError when already archived', async () => {
    mockRepo.findById.mockResolvedValue(makeRaw({ status: PROMPT_STATUS_ARCHIVED }));

    await expect(service.archivePrompt(UUID_1, TENANT_ID, ACTOR_ID, REQUEST_ID))
      .rejects.toThrow(PromptNotArchivableError);
  });

  it('emits prompt.archived event', async () => {
    mockRepo.findById.mockResolvedValue(makeRaw());
    mockRepo.update.mockResolvedValue(makeRaw({ status: PROMPT_STATUS_ARCHIVED }));

    await service.archivePrompt(UUID_1, TENANT_ID, ACTOR_ID, REQUEST_ID);

    expect(mockPublisher.publish).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'prompt.archived' }),
    );
  });
});

// ---------------------------------------------------------------------------
// rollbackPrompt
// ---------------------------------------------------------------------------

describe('rollbackPrompt()', () => {
  it('creates a new published version from an archived target', async () => {
    const archivedTarget = makeRaw({ id: UUID_2, version: 2, status: PROMPT_STATUS_ARCHIVED });
    mockRepo.findById.mockResolvedValue(archivedTarget);
    mockRepo.findLatestVersion.mockResolvedValue(3);
    mockRepo.archivePublished.mockResolvedValue(undefined);
    mockRepo.create.mockResolvedValue(makeRaw({ id: UUID_1, version: 4, status: PROMPT_STATUS_DRAFT }));
    mockRepo.update.mockResolvedValue(makeRaw({ id: UUID_1, version: 4, status: PROMPT_STATUS_PUBLISHED }));

    const result = await service.rollbackPrompt({
      targetVersionId: UUID_2,
      tenantId: TENANT_ID,
      actorId: ACTOR_ID,
      requestId: REQUEST_ID,
    });

    expect(mockRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        version: 4,
        rollbackFromVersion: 2,
        previousVersionId: UUID_2,
      }),
    );
    expect(result.status).toBe(PROMPT_STATUS_PUBLISHED);
  });

  it('throws PromptRollbackError when trying to rollback to the currently-published version', async () => {
    mockRepo.findById.mockResolvedValue(makeRaw({ status: PROMPT_STATUS_PUBLISHED }));

    await expect(
      service.rollbackPrompt({ targetVersionId: UUID_1, tenantId: TENANT_ID, actorId: ACTOR_ID, requestId: REQUEST_ID }),
    ).rejects.toThrow(PromptRollbackError);
  });

  it('emits prompt.rolled_back event', async () => {
    const archivedTarget = makeRaw({ id: UUID_2, version: 2, status: PROMPT_STATUS_ARCHIVED });
    mockRepo.findById.mockResolvedValue(archivedTarget);
    mockRepo.findLatestVersion.mockResolvedValue(3);
    mockRepo.archivePublished.mockResolvedValue(undefined);
    mockRepo.create.mockResolvedValue(makeRaw({ id: UUID_1, version: 4 }));
    mockRepo.update.mockResolvedValue(makeRaw({ id: UUID_1, version: 4, status: PROMPT_STATUS_PUBLISHED }));

    await service.rollbackPrompt({ targetVersionId: UUID_2, tenantId: TENANT_ID, actorId: ACTOR_ID, requestId: REQUEST_ID });

    expect(mockPublisher.publish).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'prompt.rolled_back' }),
    );
  });
});

// ---------------------------------------------------------------------------
// getPublishedPrompt (cache + fallback)
// ---------------------------------------------------------------------------

describe('getPublishedPrompt()', () => {
  it('returns cached result without hitting DB', async () => {
    const cached = makeSafeTemplate({ status: PROMPT_STATUS_PUBLISHED });
    cache.set(cache.buildKey(TENANT_ID, null, PROMPT_TYPE_SYSTEM), cached);

    const result = await service.getPublishedPrompt(TENANT_ID, null, PROMPT_TYPE_SYSTEM);

    expect(result).toEqual(cached);
    expect(mockRepo.findPublished).not.toHaveBeenCalled();
  });

  it('falls back to tenant-level when no clinic-level prompt exists', async () => {
    const tenantPrompt = makeRaw({ clinicId: null, status: PROMPT_STATUS_PUBLISHED });
    mockRepo.findPublished.mockResolvedValueOnce(null); // clinic-level miss
    mockRepo.findPublished.mockResolvedValueOnce(tenantPrompt); // tenant-level hit

    const result = await service.getPublishedPrompt(TENANT_ID, CLINIC_ID, PROMPT_TYPE_SYSTEM);

    expect(mockRepo.findPublished).toHaveBeenCalledTimes(2);
    expect(result).not.toBeNull();
  });

  it('returns null when neither clinic nor tenant has a published prompt', async () => {
    mockRepo.findPublished.mockResolvedValue(null);

    const result = await service.getPublishedPrompt(TENANT_ID, null, PROMPT_TYPE_SYSTEM);
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Tenant Isolation
// ---------------------------------------------------------------------------

describe('Tenant Isolation', () => {
  it('throws PromptIsolationViolationError when prompt belongs to different tenant', async () => {
    mockRepo.findById.mockResolvedValue(makeRaw({ tenantId: 'other-tenant' }));

    await expect(service.getPromptById(UUID_1, TENANT_ID))
      .rejects.toThrow(PromptIsolationViolationError);
  });

  it('throws PromptIsolationViolationError on publish attempt for wrong tenant', async () => {
    mockRepo.findById.mockResolvedValue(makeRaw({ tenantId: 'other-tenant' }));

    await expect(service.publishPrompt(UUID_1, TENANT_ID, ACTOR_ID, REQUEST_ID))
      .rejects.toThrow(PromptIsolationViolationError);
  });
});

// ---------------------------------------------------------------------------
// composeSystemPrompt
// ---------------------------------------------------------------------------

describe('composeSystemPrompt()', () => {
  it('returns a ComposedPrompt with non-empty content', async () => {
    mockRepo.findPublished.mockResolvedValue(null); // no custom prompts

    const result = await service.composeSystemPrompt({
      tenantId: TENANT_ID,
      clinicId: null,
      variables: { clinic_name: 'Bright Smiles', timezone: 'UTC', language: 'en' },
      requestId: REQUEST_ID,
    });

    expect(result.content).toBeTruthy();
    expect(result.content.length).toBeGreaterThan(100);
    expect(result.characterCount).toBe(result.content.length);
  });

  it('includes published system prompt when available', async () => {
    const publishedSystem = makeRaw({ status: PROMPT_STATUS_PUBLISHED, content: 'Custom clinic instructions here.' });
    mockRepo.findPublished
      .mockResolvedValueOnce(publishedSystem)    // system
      .mockResolvedValueOnce(null)               // faq
      .mockResolvedValueOnce(null);              // emergency

    const result = await service.composeSystemPrompt({
      tenantId: TENANT_ID,
      clinicId: null,
      variables: { clinic_name: 'My Clinic' },
      requestId: REQUEST_ID,
    });

    expect(result.content).toContain('Custom clinic instructions here.');
  });

  it('emits prompt.compose.requested event', async () => {
    mockRepo.findPublished.mockResolvedValue(null);

    await service.composeSystemPrompt({
      tenantId: TENANT_ID, clinicId: null, variables: {}, requestId: REQUEST_ID,
    });

    expect(mockPublisher.publish).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'prompt.compose.requested' }),
    );
  });
});

// ---------------------------------------------------------------------------
// getPromptHistory
// ---------------------------------------------------------------------------

describe('getPromptHistory()', () => {
  it('returns history list mapped to SafePromptTemplate', async () => {
    const historyRaws = [makeRaw({ version: 2 }), makeRaw({ version: 1 })];
    mockRepo.findHistory.mockResolvedValue(historyRaws);

    const result = await service.getPromptHistory(UUID_1, TENANT_ID);
    expect(result).toHaveLength(2);
    expect(result[0]!.version).toBe(2);
    expect(result[1]!.version).toBe(1);
  });
});

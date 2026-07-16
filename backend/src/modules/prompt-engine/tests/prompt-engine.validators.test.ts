/**
 * Prompt Engine Validators — Unit Tests
 */

import {
  CreatePromptSchema,
  UpdatePromptSchema,
  RollbackPromptSchema,
  ListPromptsSchema,
  ComposeSchema,
} from '../validators/prompt-engine.validators';

const UUID = '11111111-1111-1111-1111-111111111111';

describe('CreatePromptSchema', () => {
  it('passes with valid input', () => {
    const result = CreatePromptSchema.safeParse({
      clinicId: null,
      promptType: 'system',
      content: 'You are a dental receptionist.',
      variables: ['clinic_name'],
      changeSummary: 'Initial version',
    });
    expect(result.success).toBe(true);
  });

  it('rejects unsupported promptType', () => {
    const result = CreatePromptSchema.safeParse({
      clinicId: null,
      promptType: 'invalid_type',
      content: 'Content',
      variables: [],
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty content', () => {
    const result = CreatePromptSchema.safeParse({
      clinicId: null,
      promptType: 'greeting',
      content: '',
      variables: [],
    });
    expect(result.success).toBe(false);
  });

  it('rejects content exceeding max length', () => {
    const result = CreatePromptSchema.safeParse({
      clinicId: null,
      promptType: 'system',
      content: 'a'.repeat(32_769),
      variables: [],
    });
    expect(result.success).toBe(false);
  });

  it('transforms empty string clinicId to null', () => {
    const result = CreatePromptSchema.safeParse({
      clinicId: '',
      promptType: 'fallback',
      content: 'Fallback message',
      variables: [],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.clinicId).toBeNull();
    }
  });

  it('accepts all valid prompt types', () => {
    const types = ['system','greeting','fallback','booking','cancellation','rescheduling','faq','after_hours','emergency','goodbye'];
    for (const type of types) {
      const result = CreatePromptSchema.safeParse({ clinicId: null, promptType: type, content: 'Content', variables: [] });
      expect(result.success).toBe(true);
    }
  });
});

describe('UpdatePromptSchema', () => {
  it('passes with just content', () => {
    const result = UpdatePromptSchema.safeParse({ content: 'Updated content' });
    expect(result.success).toBe(true);
  });

  it('passes with just changeSummary', () => {
    const result = UpdatePromptSchema.safeParse({ changeSummary: 'Minor fix' });
    expect(result.success).toBe(true);
  });

  it('fails when nothing is provided', () => {
    const result = UpdatePromptSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe('RollbackPromptSchema', () => {
  it('passes with valid UUID', () => {
    const result = RollbackPromptSchema.safeParse({ targetVersionId: UUID });
    expect(result.success).toBe(true);
  });

  it('fails with non-UUID', () => {
    const result = RollbackPromptSchema.safeParse({ targetVersionId: 'not-a-uuid' });
    expect(result.success).toBe(false);
  });

  it('fails with missing field', () => {
    const result = RollbackPromptSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe('ListPromptsSchema', () => {
  it('passes with no query params (uses defaults)', () => {
    const result = ListPromptsSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.limit).toBe(50);
      expect(result.data.offset).toBe(0);
    }
  });

  it('parses limit and offset from strings', () => {
    const result = ListPromptsSchema.safeParse({ limit: '10', offset: '5' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.limit).toBe(10);
      expect(result.data.offset).toBe(5);
    }
  });

  it('rejects limit > 100', () => {
    const result = ListPromptsSchema.safeParse({ limit: '101' });
    expect(result.success).toBe(false);
  });

  it('rejects invalid status', () => {
    const result = ListPromptsSchema.safeParse({ status: 'invalid_status' });
    expect(result.success).toBe(false);
  });
});

describe('ComposeSchema', () => {
  it('passes with minimal input', () => {
    const result = ComposeSchema.safeParse({ clinicId: null });
    expect(result.success).toBe(true);
  });

  it('passes with full variables map', () => {
    const result = ComposeSchema.safeParse({
      clinicId: UUID,
      variables: { clinic_name: 'My Clinic', timezone: 'UTC' },
      conversationContext: 'Patient has a toothache.',
    });
    expect(result.success).toBe(true);
  });

  it('rejects conversationContext exceeding 4000 chars', () => {
    const result = ComposeSchema.safeParse({
      clinicId: null,
      conversationContext: 'a'.repeat(4001),
    });
    expect(result.success).toBe(false);
  });
});

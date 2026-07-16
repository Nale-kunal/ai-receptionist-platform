/**
 * Conversation Validator Unit Tests
 */

import { CreateConversationSchema } from '../validators/create-conversation.validator';
import { UpdateConversationSchema } from '../validators/update-conversation.validator';
import { UpdateTranscriptSchema } from '../validators/update-transcript.validator';
import { UpdateSummarySchema } from '../validators/update-summary.validator';
import { LinkRecordingSchema } from '../validators/link-recording.validator';
import { ListConversationsSchema } from '../validators/list-conversations.validator';

const CLINIC_ID = '550e8400-e29b-41d4-a716-446655440001';

describe('CreateConversationSchema', () => {
  const valid = {
    clinicId: CLINIC_ID,
    callSessionId: 'session-123',
    startedAt: '2025-01-01T09:00:00.000Z',
  };

  it('should pass for a valid conversation payload', () => {
    const result = CreateConversationSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('should fail when clinicId is not a UUID', () => {
    const result = CreateConversationSchema.safeParse({ ...valid, clinicId: 'invalid' });
    expect(result.success).toBe(false);
  });
});

describe('UpdateConversationSchema', () => {
  it('should pass with valid intent/sentiment update', () => {
    const result = UpdateConversationSchema.safeParse({ intent: 'reschedule', sentiment: 'neutral' });
    expect(result.success).toBe(true);
  });

  it('should fail if no fields are provided', () => {
    const result = UpdateConversationSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe('UpdateTranscriptSchema', () => {
  it('should pass for a valid transcript turn array', () => {
    const result = UpdateTranscriptSchema.safeParse({
      turns: [
        {
          sequence: 0,
          speaker: 'ai',
          message: 'Hello, how can I help?',
          timestamp: '2025-01-01T09:00:00.000Z',
        },
      ],
    });
    expect(result.success).toBe(true);
  });
});

describe('UpdateSummarySchema', () => {
  it('should pass for a valid summary structure', () => {
    const result = UpdateSummarySchema.safeParse({
      summary: {
        text: 'Patient requested reschedule.',
        primaryIntent: 'reschedule',
        generatedAt: '2025-01-01T09:05:00.000Z',
      },
    });
    expect(result.success).toBe(true);
  });
});

describe('LinkRecordingSchema', () => {
  it('should pass for a valid recording details payload', () => {
    const result = LinkRecordingSchema.safeParse({
      recordingReference: 'http://foo.bar/recording.mp3',
      recordingProvider: 'twilio',
      recordingStatus: 'available',
    });
    expect(result.success).toBe(true);
  });
});

describe('ListConversationsSchema', () => {
  it('should parse valid query strings and apply default limits', () => {
    const result = ListConversationsSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.limit).toBe(20);
    }
  });
});

/**
 * Conversation Service Unit Tests
 */

import { ConversationService } from '../services/conversation.service';
import {
  ConversationNotFoundError,
  ConversationIsolationViolationError,
  InvalidConversationStatusTransitionError,
  ConversationAlreadyTerminalError,
  ConversationTranscriptImmutableError,
  ClinicNotActiveForConversationError,
  ConversationOwnershipError,
} from '../errors/conversation.errors';
import {
  EVENT_CONVERSATION_STARTED,
  EVENT_CONVERSATION_UPDATED,
  EVENT_CONVERSATION_COMPLETED,
  EVENT_CONVERSATION_FAILED,
  EVENT_CONVERSATION_ARCHIVED,
  EVENT_TRANSCRIPT_UPDATED,
  EVENT_SUMMARY_GENERATED,
  EVENT_RECORDING_LINKED,
  EVENT_CONVERSATION_DELETED,
} from '../events/conversation.events';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockRepository = {
  create: jest.fn(),
  update: jest.fn(),
  findById: jest.fn(),
  findByPublicId: jest.fn(),
  findMany: jest.fn(),
  clinicIsActive: jest.fn(),
  patientBelongsToClinic: jest.fn(),
  appointmentBelongsToClinic: jest.fn(),
};

const mockPublisher = { publish: jest.fn() };

// ---------------------------------------------------------------------------
// Test Data
// ---------------------------------------------------------------------------

const TENANT_ID = '550e8400-e29b-41d4-a716-446655440000';
const CLINIC_ID = '550e8400-e29b-41d4-a716-446655440001';
const PATIENT_ID = '550e8400-e29b-41d4-a716-446655440002';
const APPT_ID = '550e8400-e29b-41d4-a716-446655440003';
const CONV_ID = '550e8400-e29b-41d4-a716-446655440004';

const START = new Date('2025-01-01T09:00:00Z');

function makeConv(overrides: Record<string, unknown> = {}) {
  return {
    id: CONV_ID,
    publicId: 'conv_abc123',
    tenantId: TENANT_ID,
    clinicId: CLINIC_ID,
    patientId: null,
    doctorId: null,
    appointmentId: null,
    callSessionId: 'session-123',
    callerPhone: '+1234567890',
    startedAt: START,
    endedAt: null,
    durationSeconds: null,
    status: 'initiated',
    language: 'en',
    transcript: [],
    transcriptVersion: 0,
    summary: null,
    extractedEntities: null,
    intent: null,
    sentiment: null,
    recordingReference: null,
    recordingProvider: null,
    recordingStatus: null,
    inputTokens: null,
    outputTokens: null,
    totalTokens: null,
    estimatedCostUsd: null,
    aiModel: null,
    aiProvider: null,
    metadata: {},
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...overrides,
  };
}

function setupHappyPath() {
  mockRepository.clinicIsActive.mockResolvedValue(true);
  mockRepository.patientBelongsToClinic.mockResolvedValue(true);
  mockRepository.appointmentBelongsToClinic.mockResolvedValue(true);
  mockRepository.create.mockResolvedValue(makeConv());
  mockRepository.findById.mockResolvedValue(makeConv());
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ConversationService', () => {
  let service: ConversationService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ConversationService(mockRepository as any, mockPublisher as any);
  });

  // -------------------------------------------------------------------------
  // createConversation
  // -------------------------------------------------------------------------

  describe('createConversation', () => {
    const params = {
      tenantId: TENANT_ID,
      clinicId: CLINIC_ID,
      callSessionId: 'session-123',
      startedAt: START,
      actorId: 'actor-1',
      requestId: 'req-1',
    };

    it('should create successfully when all validations pass', async () => {
      setupHappyPath();

      const result = await service.createConversation(params);

      expect(mockRepository.clinicIsActive).toHaveBeenCalledWith(CLINIC_ID, TENANT_ID);
      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'initiated' }),
      );
      expect(mockPublisher.publish).toHaveBeenCalledWith(
        expect.objectContaining({ type: EVENT_CONVERSATION_STARTED }),
      );
      expect(result.id).toBe(CONV_ID);
      expect(result.status).toBe('initiated');
    });

    it('should throw ClinicNotActiveForConversationError when clinic is not active', async () => {
      mockRepository.clinicIsActive.mockResolvedValue(false);
      await expect(service.createConversation(params)).rejects.toThrow(ClinicNotActiveForConversationError);
    });

    it('should throw ConversationOwnershipError when patient does not belong to clinic', async () => {
      mockRepository.clinicIsActive.mockResolvedValue(true);
      mockRepository.patientBelongsToClinic.mockResolvedValue(false);
      await expect(
        service.createConversation({ ...params, patientId: PATIENT_ID }),
      ).rejects.toThrow(ConversationOwnershipError);
    });

    it('should throw ConversationOwnershipError when appointment does not belong to clinic', async () => {
      mockRepository.clinicIsActive.mockResolvedValue(true);
      mockRepository.appointmentBelongsToClinic.mockResolvedValue(false);
      await expect(
        service.createConversation({ ...params, appointmentId: APPT_ID }),
      ).rejects.toThrow(ConversationOwnershipError);
    });
  });

  // -------------------------------------------------------------------------
  // updateConversation
  // -------------------------------------------------------------------------

  describe('updateConversation', () => {
    it('should update metadata/entities and publish updated event', async () => {
      setupHappyPath();
      mockRepository.update.mockResolvedValue(makeConv({ intent: 'booking' }));

      const result = await service.updateConversation({
        id: CONV_ID,
        tenantId: TENANT_ID,
        intent: 'booking',
        actorId: 'actor-1',
        requestId: 'req-1',
      });

      expect(mockRepository.update).toHaveBeenCalledWith(
        CONV_ID,
        expect.objectContaining({ intent: 'booking' }),
      );
      expect(mockPublisher.publish).toHaveBeenCalledWith(
        expect.objectContaining({ type: EVENT_CONVERSATION_UPDATED }),
      );
      expect(result.intent).toBe('booking');
    });

    it('should throw ConversationAlreadyTerminalError when conversation is in a terminal status', async () => {
      mockRepository.findById.mockResolvedValue(makeConv({ status: 'failed' }));
      await expect(
        service.updateConversation({
          id: CONV_ID,
          tenantId: TENANT_ID,
          intent: 'booking',
          actorId: 'actor-1',
          requestId: 'req-1',
        }),
      ).rejects.toThrow(ConversationAlreadyTerminalError);
    });
  });

  // -------------------------------------------------------------------------
  // updateTranscript
  // -------------------------------------------------------------------------

  describe('updateTranscript', () => {
    const turns = [
      { sequence: 0, speaker: 'ai', message: 'Hello', timestamp: START.toISOString() },
    ];

    it('should update transcript, increment version, and publish event', async () => {
      setupHappyPath();
      mockRepository.update.mockResolvedValue(makeConv({ transcript: turns, transcriptVersion: 1 }));

      const result = await service.updateTranscript({
        id: CONV_ID,
        tenantId: TENANT_ID,
        turns,
        actorId: 'actor-1',
        requestId: 'req-1',
      });

      expect(mockRepository.update).toHaveBeenCalledWith(
        CONV_ID,
        expect.objectContaining({ transcript: turns, transcriptVersion: 1 }),
      );
      expect(mockPublisher.publish).toHaveBeenCalledWith(
        expect.objectContaining({ type: EVENT_TRANSCRIPT_UPDATED }),
      );
      expect(result.transcriptVersion).toBe(1);
    });

    it('should throw ConversationTranscriptImmutableError when conversation is completed', async () => {
      mockRepository.findById.mockResolvedValue(makeConv({ status: 'completed' }));
      await expect(
        service.updateTranscript({
          id: CONV_ID,
          tenantId: TENANT_ID,
          turns,
          actorId: 'actor-1',
          requestId: 'req-1',
        }),
      ).rejects.toThrow(ConversationTranscriptImmutableError);
    });
  });

  // -------------------------------------------------------------------------
  // updateSummary
  // -------------------------------------------------------------------------

  describe('updateSummary', () => {
    const summary = {
      text: 'Patient called to confirm details.',
      primaryIntent: 'confirmation',
      outcome: 'confirmed',
      generatedAt: START.toISOString(),
    };

    it('should update summary and intent and publish event', async () => {
      setupHappyPath();
      mockRepository.update.mockResolvedValue(makeConv({ summary, intent: 'confirmation' }));

      const result = await service.updateSummary({
        id: CONV_ID,
        tenantId: TENANT_ID,
        summary,
        actorId: 'actor-1',
        requestId: 'req-1',
      });

      expect(mockRepository.update).toHaveBeenCalledWith(
        CONV_ID,
        expect.objectContaining({ summary, intent: 'confirmation' }),
      );
      expect(mockPublisher.publish).toHaveBeenCalledWith(
        expect.objectContaining({ type: EVENT_SUMMARY_GENERATED }),
      );
    });
  });

  // -------------------------------------------------------------------------
  // linkRecording
  // -------------------------------------------------------------------------

  describe('linkRecording', () => {
    it('should update recording reference and publish event', async () => {
      setupHappyPath();
      mockRepository.update.mockResolvedValue(makeConv({
        recordingReference: 'http://s3/rec.wav',
        recordingProvider: 'aws',
        recordingStatus: 'available',
      }));

      const result = await service.linkRecording({
        id: CONV_ID,
        tenantId: TENANT_ID,
        recordingReference: 'http://s3/rec.wav',
        recordingProvider: 'aws',
        recordingStatus: 'available',
        actorId: 'actor-1',
        requestId: 'req-1',
      });

      expect(mockRepository.update).toHaveBeenCalledWith(
        CONV_ID,
        expect.objectContaining({
          recordingReference: 'http://s3/rec.wav',
          recordingProvider: 'aws',
          recordingStatus: 'available',
        }),
      );
      expect(result.recordingReference).toBe('http://s3/rec.wav');
    });
  });

  // -------------------------------------------------------------------------
  // completeConversation
  // -------------------------------------------------------------------------

  describe('completeConversation', () => {
    it('should change status to completed and calculate duration', async () => {
      setupHappyPath();
      mockRepository.findById.mockResolvedValue(makeConv({ startedAt: START, status: 'active' }));
      mockRepository.update.mockResolvedValue(makeConv({
        status: 'completed',
        endedAt: new Date(START.getTime() + 30000),
        durationSeconds: 30,
      }));

      const result = await service.completeConversation({
        id: CONV_ID,
        tenantId: TENANT_ID,
        endedAt: new Date(START.getTime() + 30000),
        actorId: 'actor-1',
        requestId: 'req-1',
      });

      expect(result.status).toBe('completed');
      expect(result.durationSeconds).toBe(30);
    });
  });

  // -------------------------------------------------------------------------
  // softDeleteConversation
  // -------------------------------------------------------------------------

  describe('softDeleteConversation', () => {
    it('should update deletedAt and publish deleted event', async () => {
      setupHappyPath();

      await service.softDeleteConversation(CONV_ID, TENANT_ID, 'actor-1', 'req-1');

      expect(mockRepository.update).toHaveBeenCalledWith(
        CONV_ID,
        expect.objectContaining({ deletedAt: expect.any(Date) }),
      );
      expect(mockPublisher.publish).toHaveBeenCalledWith(
        expect.objectContaining({ type: EVENT_CONVERSATION_DELETED }),
      );
    });
  });
});

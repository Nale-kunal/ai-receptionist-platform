/**
 * Conversation Service
 *
 * Implements the full conversation lifecycle.
 *
 * This module is STORAGE ONLY:
 *   - Validates tenant/clinic isolation
 *   - Enforces status state machine
 *   - Publishes audit events
 *   - Stores transcript, summary, entities, recording metadata, token usage
 *
 * This module NEVER:
 *   - Creates or modifies appointments
 *   - Executes AI inference
 *   - Streams audio
 *   - Sends notifications
 *
 * State Machine (per contract):
 *   initiated → active | abandoned | failed
 *   active    → completed | abandoned | failed
 *   completed → archived
 *   abandoned → (terminal)
 *   failed    → (terminal)
 *   archived  → (terminal)
 */

import type {
  IConversationService,
  IConversationRepository,
  CreateConversationParams,
  UpdateConversationParams,
  UpdateTranscriptParams,
  UpdateSummaryParams,
  LinkRecordingParams,
  CompleteConversationParams,
  ListConversationsParams,
} from '../interfaces/conversation.interfaces';
import type { IConversationEventPublisher } from '../events/conversation-event.publisher';
import type { SafeConversation, TranscriptTurn, ConversationSummary } from '../types/conversation.types';
import type { ConversationStatus } from '../constants/conversation.constants';
import {
  CONVERSATION_STATUS_INITIATED,
  CONVERSATION_STATUS_ACTIVE,
  CONVERSATION_STATUS_COMPLETED,
  CONVERSATION_STATUS_ABANDONED,
  CONVERSATION_STATUS_FAILED,
  CONVERSATION_STATUS_ARCHIVED,
  TERMINAL_CONVERSATION_STATUSES,
} from '../constants/conversation.constants';
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
// State Machine
// ---------------------------------------------------------------------------

const ALLOWED_TRANSITIONS: Record<ConversationStatus, ConversationStatus[]> = {
  [CONVERSATION_STATUS_INITIATED]: [
    CONVERSATION_STATUS_ACTIVE,
    CONVERSATION_STATUS_ABANDONED,
    CONVERSATION_STATUS_FAILED,
  ],
  [CONVERSATION_STATUS_ACTIVE]: [
    CONVERSATION_STATUS_COMPLETED,
    CONVERSATION_STATUS_ABANDONED,
    CONVERSATION_STATUS_FAILED,
  ],
  [CONVERSATION_STATUS_COMPLETED]: [
    CONVERSATION_STATUS_ARCHIVED,
  ],
  [CONVERSATION_STATUS_ABANDONED]: [],
  [CONVERSATION_STATUS_FAILED]:    [],
  [CONVERSATION_STATUS_ARCHIVED]:  [],
};

// ---------------------------------------------------------------------------
// Service Implementation
// ---------------------------------------------------------------------------

export class ConversationService implements IConversationService {
  constructor(
    private readonly repository: IConversationRepository,
    private readonly publisher: IConversationEventPublisher,
  ) {}

  // -------------------------------------------------------------------------
  // Create
  // -------------------------------------------------------------------------

  public async createConversation(params: CreateConversationParams): Promise<SafeConversation> {
    // 1. Clinic must be active
    const clinicActive = await this.repository.clinicIsActive(params.clinicId, params.tenantId);
    if (!clinicActive) {
      throw new ClinicNotActiveForConversationError();
    }

    // 2. If patientId provided, verify ownership
    if (params.patientId) {
      const valid = await this.repository.patientBelongsToClinic(
        params.patientId,
        params.clinicId,
        params.tenantId,
      );
      if (!valid) {
        throw new ConversationOwnershipError('Patient');
      }
    }

    // 3. If appointmentId provided, verify ownership
    if (params.appointmentId) {
      const valid = await this.repository.appointmentBelongsToClinic(
        params.appointmentId,
        params.clinicId,
        params.tenantId,
      );
      if (!valid) {
        throw new ConversationOwnershipError('Appointment');
      }
    }

    // 4. Persist
    const created = await this.repository.create({
      tenantId:      params.tenantId,
      clinicId:      params.clinicId,
      patientId:     params.patientId,
      doctorId:      params.doctorId,
      appointmentId: params.appointmentId,
      callSessionId: params.callSessionId,
      callerPhone:   params.callerPhone,
      startedAt:     params.startedAt,
      status:        CONVERSATION_STATUS_INITIATED,
      language:      params.language ?? 'en',
      metadata:      params.metadata,
    });

    const safe = this.toSafe(created);

    // 5. Publish
    await this.publisher.publish({
      type: EVENT_CONVERSATION_STARTED,
      payload: {
        tenantId:       safe.tenantId,
        clinicId:       safe.clinicId,
        conversationId: safe.id,
        actorId:        params.actorId,
        requestId:      params.requestId,
        occurredAt:     new Date(),
        callSessionId:  safe.callSessionId,
        patientId:      safe.patientId,
        language:       safe.language,
      },
    });

    return safe;
  }

  // -------------------------------------------------------------------------
  // Update (metadata / AI fields / entity links)
  // -------------------------------------------------------------------------

  public async updateConversation(params: UpdateConversationParams): Promise<SafeConversation> {
    const existing = await this.requireConversation(params.id, params.tenantId);
    this.assertNotTerminal(existing.status);

    // Validate optional entity ownership updates
    if (params.patientId) {
      const valid = await this.repository.patientBelongsToClinic(
        params.patientId,
        existing.clinicId,
        existing.tenantId,
      );
      if (!valid) throw new ConversationOwnershipError('Patient');
    }
    if (params.appointmentId) {
      const valid = await this.repository.appointmentBelongsToClinic(
        params.appointmentId,
        existing.clinicId,
        existing.tenantId,
      );
      if (!valid) throw new ConversationOwnershipError('Appointment');
    }

    const changedFields: string[] = [];
    const updateData: Record<string, unknown> = {};
    const fields: Array<keyof UpdateConversationParams> = [
      'patientId', 'doctorId', 'appointmentId', 'intent', 'sentiment',
      'extractedEntities', 'inputTokens', 'outputTokens', 'totalTokens',
      'estimatedCostUsd', 'aiModel', 'aiProvider', 'metadata',
    ];

    for (const field of fields) {
      if (params[field] !== undefined) {
        updateData[field] = params[field];
        changedFields.push(field);
      }
    }

    const updated = await this.repository.update(params.id, updateData);
    const safe = this.toSafe(updated);

    await this.publisher.publish({
      type: EVENT_CONVERSATION_UPDATED,
      payload: {
        tenantId:       safe.tenantId,
        clinicId:       safe.clinicId,
        conversationId: safe.id,
        actorId:        params.actorId,
        requestId:      params.requestId,
        occurredAt:     new Date(),
        changedFields,
      },
    });

    return safe;
  }

  // -------------------------------------------------------------------------
  // Update Transcript
  // -------------------------------------------------------------------------

  public async updateTranscript(params: UpdateTranscriptParams): Promise<SafeConversation> {
    const existing = await this.requireConversation(params.id, params.tenantId);

    // Transcript is immutable after completion per contract
    if (existing.status === CONVERSATION_STATUS_COMPLETED ||
        existing.status === CONVERSATION_STATUS_ARCHIVED) {
      throw new ConversationTranscriptImmutableError();
    }
    this.assertNotTerminal(existing.status);

    const newVersion = existing.transcriptVersion + 1;
    const updated = await this.repository.update(params.id, {
      transcript:        params.turns,
      transcriptVersion: newVersion,
    });
    const safe = this.toSafe(updated);

    await this.publisher.publish({
      type: EVENT_TRANSCRIPT_UPDATED,
      payload: {
        tenantId:          safe.tenantId,
        clinicId:          safe.clinicId,
        conversationId:    safe.id,
        actorId:           params.actorId,
        requestId:         params.requestId,
        occurredAt:        new Date(),
        transcriptVersion: newVersion,
        turnCount:         params.turns.length,
      },
    });

    return safe;
  }

  // -------------------------------------------------------------------------
  // Update Summary
  // -------------------------------------------------------------------------

  public async updateSummary(params: UpdateSummaryParams): Promise<SafeConversation> {
    const existing = await this.requireConversation(params.id, params.tenantId);
    // Summary can be set/updated even on completed, but not after archive/delete
    if (existing.status === CONVERSATION_STATUS_ARCHIVED) {
      throw new ConversationAlreadyTerminalError(existing.status);
    }
    if (existing.deletedAt !== null) {
      throw new ConversationNotFoundError(params.id);
    }

    const updated = await this.repository.update(params.id, {
      summary: params.summary,
      intent:  params.summary.primaryIntent ?? existing.intent,
    });
    const safe = this.toSafe(updated);

    await this.publisher.publish({
      type: EVENT_SUMMARY_GENERATED,
      payload: {
        tenantId:       safe.tenantId,
        clinicId:       safe.clinicId,
        conversationId: safe.id,
        actorId:        params.actorId,
        requestId:      params.requestId,
        occurredAt:     new Date(),
        intent:         params.summary.primaryIntent ?? null,
      },
    });

    return safe;
  }

  // -------------------------------------------------------------------------
  // Link Recording
  // -------------------------------------------------------------------------

  public async linkRecording(params: LinkRecordingParams): Promise<SafeConversation> {
    const existing = await this.requireConversation(params.id, params.tenantId);
    this.assertNotTerminal(existing.status);

    const updated = await this.repository.update(params.id, {
      recordingReference: params.recordingReference,
      recordingProvider:  params.recordingProvider,
      recordingStatus:    params.recordingStatus,
    });
    const safe = this.toSafe(updated);

    await this.publisher.publish({
      type: EVENT_RECORDING_LINKED,
      payload: {
        tenantId:          safe.tenantId,
        clinicId:          safe.clinicId,
        conversationId:    safe.id,
        actorId:           params.actorId,
        requestId:         params.requestId,
        occurredAt:        new Date(),
        recordingProvider: params.recordingProvider,
        recordingStatus:   params.recordingStatus,
      },
    });

    return safe;
  }

  // -------------------------------------------------------------------------
  // Complete
  // -------------------------------------------------------------------------

  public async completeConversation(params: CompleteConversationParams): Promise<SafeConversation> {
    const existing = await this.requireConversation(params.id, params.tenantId);
    this.assertTransitionAllowed(existing.status, CONVERSATION_STATUS_COMPLETED);

    const endedAt = params.endedAt ?? new Date();
    const durationSeconds = params.durationSeconds ??
      Math.floor((endedAt.getTime() - existing.startedAt.getTime()) / 1000);

    const updated = await this.repository.update(params.id, {
      status:          CONVERSATION_STATUS_COMPLETED,
      endedAt,
      durationSeconds,
    });
    const safe = this.toSafe(updated);

    await this.publisher.publish({
      type: EVENT_CONVERSATION_COMPLETED,
      payload: {
        tenantId:        safe.tenantId,
        clinicId:        safe.clinicId,
        conversationId:  safe.id,
        actorId:         params.actorId,
        requestId:       params.requestId,
        occurredAt:      new Date(),
        durationSeconds,
      },
    });

    return safe;
  }

  // -------------------------------------------------------------------------
  // Fail
  // -------------------------------------------------------------------------

  public async failConversation(
    id: string,
    tenantId: string,
    actorId: string,
    requestId: string,
  ): Promise<SafeConversation> {
    const existing = await this.requireConversation(id, tenantId);
    this.assertTransitionAllowed(existing.status, CONVERSATION_STATUS_FAILED);

    const now = new Date();
    const updated = await this.repository.update(id, {
      status:  CONVERSATION_STATUS_FAILED,
      endedAt: now,
    });
    const safe = this.toSafe(updated);

    await this.publisher.publish({
      type: EVENT_CONVERSATION_FAILED,
      payload: {
        tenantId:       safe.tenantId,
        clinicId:       safe.clinicId,
        conversationId: safe.id,
        actorId,
        requestId,
        occurredAt:     now,
      },
    });

    return safe;
  }

  // -------------------------------------------------------------------------
  // Archive
  // -------------------------------------------------------------------------

  public async archiveConversation(
    id: string,
    tenantId: string,
    actorId: string,
    requestId: string,
  ): Promise<SafeConversation> {
    const existing = await this.requireConversation(id, tenantId);
    this.assertTransitionAllowed(existing.status, CONVERSATION_STATUS_ARCHIVED);

    const updated = await this.repository.update(id, { status: CONVERSATION_STATUS_ARCHIVED });
    const safe = this.toSafe(updated);

    await this.publisher.publish({
      type: EVENT_CONVERSATION_ARCHIVED,
      payload: {
        tenantId:       safe.tenantId,
        clinicId:       safe.clinicId,
        conversationId: safe.id,
        actorId,
        requestId,
        occurredAt:     new Date(),
      },
    });

    return safe;
  }

  // -------------------------------------------------------------------------
  // Soft Delete
  // -------------------------------------------------------------------------

  public async softDeleteConversation(
    id: string,
    tenantId: string,
    actorId: string,
    requestId: string,
  ): Promise<void> {
    const existing = await this.requireConversation(id, tenantId);
    const now = new Date();

    await this.repository.update(id, { deletedAt: now });

    await this.publisher.publish({
      type: EVENT_CONVERSATION_DELETED,
      payload: {
        tenantId:       existing.tenantId,
        clinicId:       existing.clinicId,
        conversationId: existing.id,
        actorId,
        requestId,
        occurredAt:     now,
      },
    });
  }

  // -------------------------------------------------------------------------
  // Read
  // -------------------------------------------------------------------------

  public async getConversationById(id: string, tenantId: string): Promise<SafeConversation> {
    const record = await this.repository.findById(id);
    if (!record) {
      throw new ConversationNotFoundError(id);
    }
    const safe = this.toSafe(record);
    if (safe.tenantId !== tenantId) {
      throw new ConversationIsolationViolationError();
    }
    return safe;
  }

  public async getConversationByPublicId(publicId: string, tenantId: string): Promise<SafeConversation> {
    const record = await this.repository.findByPublicId(publicId);
    if (!record) {
      throw new ConversationNotFoundError();
    }
    const safe = this.toSafe(record);
    if (safe.tenantId !== tenantId) {
      throw new ConversationIsolationViolationError();
    }
    return safe;
  }

  public async listConversations(params: ListConversationsParams): Promise<SafeConversation[]> {
    const records = await this.repository.findMany({
      tenantId:      params.tenantId,
      clinicId:      params.clinicId,
      patientId:     params.patientId,
      doctorId:      params.doctorId,
      appointmentId: params.appointmentId,
      status:        params.status,
      intent:        params.intent,
      language:      params.language,
      publicId:      params.publicId,
      callSessionId: params.callSessionId,
      startedFrom:   params.startedFrom,
      startedTo:     params.startedTo,
      limit:         params.limit,
      offset:        params.offset,
    });
    return records.map((r) => this.toSafe(r));
  }

  // -------------------------------------------------------------------------
  // Private Helpers
  // -------------------------------------------------------------------------

  private async requireConversation(id: string, tenantId: string): Promise<SafeConversation> {
    const record = await this.repository.findById(id);
    if (!record) {
      throw new ConversationNotFoundError(id);
    }
    const safe = this.toSafe(record);
    if (safe.tenantId !== tenantId) {
      throw new ConversationIsolationViolationError();
    }
    return safe;
  }

  private assertNotTerminal(status: ConversationStatus): void {
    if ((TERMINAL_CONVERSATION_STATUSES as readonly string[]).includes(status)) {
      throw new ConversationAlreadyTerminalError(status);
    }
  }

  private assertTransitionAllowed(from: ConversationStatus, to: ConversationStatus): void {
    if ((TERMINAL_CONVERSATION_STATUSES as readonly string[]).includes(from)) {
      throw new ConversationAlreadyTerminalError(from);
    }
    const allowed = ALLOWED_TRANSITIONS[from] ?? [];
    if (!allowed.includes(to)) {
      throw new InvalidConversationStatusTransitionError(from, to);
    }
  }

  private toSafe(record: any): SafeConversation {
    return {
      id:                 record.id,
      publicId:           record.publicId,
      tenantId:           record.tenantId,
      clinicId:           record.clinicId,
      patientId:          record.patientId ?? null,
      doctorId:           record.doctorId  ?? null,
      appointmentId:      record.appointmentId ?? null,
      callSessionId:      record.callSessionId,
      callerPhone:        record.callerPhone ?? null,
      startedAt:          record.startedAt,
      endedAt:            record.endedAt ?? null,
      durationSeconds:    record.durationSeconds ?? null,
      status:             record.status as ConversationStatus,
      language:           record.language,
      transcript:         Array.isArray(record.transcript) ? (record.transcript as TranscriptTurn[]) : [],
      transcriptVersion:  record.transcriptVersion ?? 0,
      summary:            record.summary ? (record.summary as ConversationSummary) : null,
      extractedEntities:  record.extractedEntities ? (record.extractedEntities as Record<string, unknown>) : null,
      intent:             record.intent ?? null,
      sentiment:          record.sentiment ?? null,
      recordingReference: record.recordingReference ?? null,
      recordingProvider:  record.recordingProvider ?? null,
      recordingStatus:    record.recordingStatus ?? null,
      inputTokens:        record.inputTokens ?? null,
      outputTokens:       record.outputTokens ?? null,
      totalTokens:        record.totalTokens ?? null,
      estimatedCostUsd:   record.estimatedCostUsd?.toString() ?? null,
      aiModel:            record.aiModel ?? null,
      aiProvider:         record.aiProvider ?? null,
      metadata:           record.metadata ? (record.metadata as Record<string, unknown>) : null,
      createdAt:          record.createdAt,
      updatedAt:          record.updatedAt,
      deletedAt:          record.deletedAt ?? null,
    };
  }
}

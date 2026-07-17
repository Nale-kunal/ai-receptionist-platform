import type {
  SafeOrchestrationSession,
  OrchestrationContext,
  OrchestrationTurn,
} from './conversation-orchestrator.types';
import { type OrchestrationState, ORCHESTRATION_STATE_CREATED } from './conversation-orchestrator.constants';

export class OrchestrationSessionModel {
  public readonly id: string; // Internal UUID
  public readonly publicId: string; // exposed sessionId
  public readonly tenantId: string;
  public readonly clinicId: string | null;
  public readonly conversationId: string;
  public readonly state: OrchestrationState;
  public readonly createdAt: Date;
  public readonly updatedAt: Date;
  public readonly endedAt: Date | null;
  public readonly turns: OrchestrationTurn[];
  public readonly context: OrchestrationContext;

  constructor(params: {
    id: string;
    publicId: string;
    tenantId: string;
    clinicId: string | null;
    conversationId: string;
    state?: OrchestrationState;
    createdAt?: Date;
    updatedAt?: Date;
    endedAt?: Date | null;
    turns?: OrchestrationTurn[];
    context?: OrchestrationContext;
  }) {
    this.id = params.id;
    this.publicId = params.publicId;
    this.tenantId = params.tenantId;
    this.clinicId = params.clinicId;
    this.conversationId = params.conversationId;
    this.state = params.state ?? ORCHESTRATION_STATE_CREATED;
    this.createdAt = params.createdAt ?? new Date();
    this.updatedAt = params.updatedAt ?? new Date();
    this.endedAt = params.endedAt ?? null;
    this.turns = params.turns ?? [];
    this.context = params.context ?? {
      tenantId: params.tenantId,
      clinicId: params.clinicId,
      patientId: null,
      doctorId: null,
      appointmentId: null,
      conversationId: params.conversationId,
      aiSessionId: null,
      promptVersion: null,
      variables: {},
      providerMetadata: {},
    };
  }

  public copyWith(params: Partial<{
    state: OrchestrationState;
    endedAt: Date | null;
    turns: OrchestrationTurn[];
    context: OrchestrationContext;
    updatedAt: Date;
  }>): OrchestrationSessionModel {
    return new OrchestrationSessionModel({
      id: this.id,
      publicId: this.publicId,
      tenantId: this.tenantId,
      clinicId: this.clinicId,
      conversationId: this.conversationId,
      state: params.state !== undefined ? params.state : this.state,
      createdAt: this.createdAt,
      updatedAt: params.updatedAt !== undefined ? params.updatedAt : new Date(),
      endedAt: params.endedAt !== undefined ? params.endedAt : this.endedAt,
      turns: params.turns !== undefined ? params.turns : this.turns,
      context: params.context !== undefined ? params.context : this.context,
    });
  }

  public toSafeSession(): SafeOrchestrationSession {
    return {
      sessionId: this.publicId,
      tenantId: this.tenantId,
      clinicId: this.clinicId,
      conversationId: this.conversationId,
      state: this.state,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      endedAt: this.endedAt,
      turns: this.turns,
      context: this.context,
    };
  }
}

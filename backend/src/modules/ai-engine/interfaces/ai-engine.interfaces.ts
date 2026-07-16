/**
 * AI Engine Interfaces
 */

import type {
  AiMessage,
  AiToolDefinition,
  AiProviderResponse,
  AiParseResult,
  StructuredAiResponse,
  SafeAiAuditLog,
} from '../types/ai-engine.types';
import type { AiEngineDomainEvent } from '../events/ai-engine.events';

export interface IAiProvider {
  generateResponse(
    messages: AiMessage[],
    tools: AiToolDefinition[],
    options?: {
      model?: string;
      temperature?: number;
      responseFormat?: 'text' | 'json';
    },
  ): Promise<AiProviderResponse>;
}

export interface IAiAuditLogRepository {
  create(data: {
    tenantId: string;
    clinicId: string | null;
    conversationId: string;
    provider: string;
    eventType: string;
    requestId: string | null;
    metadata?: Record<string, unknown> | null;
  }): Promise<unknown>;

  findMany(params: {
    tenantId: string;
    clinicId?: string | null;
    conversationId?: string;
    limit?: number;
    offset?: number;
  }): Promise<unknown[]>;
}

export interface IAiEngineEventPublisher {
  publish(event: AiEngineDomainEvent): Promise<void>;
}

export interface IAiEngineService {
  chat(params: {
    tenantId: string;
    clinicId: string | null;
    conversationId: string;
    message: string;
    actorId: string;
    requestId: string;
  }): Promise<StructuredAiResponse>;

  parse(params: {
    tenantId: string;
    clinicId: string | null;
    message: string;
    requestId: string;
  }): Promise<AiParseResult>;
}

/**
 * AI Engine Type Definitions
 */

export interface AiMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  name?: string;
  toolCallId?: string;
  toolCalls?: AiToolCall[];
}

export interface AiToolCall {
  id: string;
  name: string;
  arguments: string; // JSON string
}

export interface AiToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export interface AiTokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface AiProviderResponse {
  content: string | null;
  toolCalls?: AiToolCall[];
  usage: AiTokenUsage;
  model: string;
  provider: string;
}

export interface AiParseResult {
  intent: string;
  entities: Record<string, unknown>;
  confidence: number;
}

export interface StructuredAiResponse {
  reply: string;
  intent: string;
  entities: Record<string, unknown>;
  confidence: number;
  toolRequests?: Array<{
    id: string;
    name: string;
    arguments: Record<string, unknown>;
  }>;
}

export interface SafeAiAuditLog {
  id: string;
  tenantId: string;
  clinicId: string | null;
  conversationId: string;
  provider: string;
  eventType: string;
  requestId: string | null;
  metadata: Record<string, unknown> | null;
  occurredAt: Date;
}

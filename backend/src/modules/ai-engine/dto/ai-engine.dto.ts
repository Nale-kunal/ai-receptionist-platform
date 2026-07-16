/**
 * AI Engine DTOs
 */

import type {
  StructuredAiResponse,
  AiParseResult,
  SafeAiAuditLog,
} from '../types/ai-engine.types';

export interface ChatRequestDto {
  clinicId: string | null;
  conversationId: string;
  message: string;
}

export interface ChatResponseDto {
  success: boolean;
  data: {
    response: StructuredAiResponse;
  };
  requestId: string;
  timestamp: string;
}

export interface ParseRequestDto {
  clinicId: string | null;
  message: string;
}

export interface ParseResponseDto {
  success: boolean;
  data: {
    parseResult: AiParseResult;
  };
  requestId: string;
  timestamp: string;
}

export interface ListAuditLogsResponseDto {
  success: boolean;
  data: {
    auditLogs: SafeAiAuditLog[];
    total: number;
  };
  requestId: string;
  timestamp: string;
}

import type { PrismaClient } from '@prisma/client';
import { Prisma } from '@prisma/client';
import type { IToolAuditLogger } from './ai-tool.interfaces';
import type { ToolRequest, ToolResult } from './ai-tool.types';

export class ToolAuditLogger implements IToolAuditLogger {
  constructor(private readonly prisma: PrismaClient) {}

  public async logRequested(request: ToolRequest): Promise<void> {
    await this.writeAudit({
      tenantId: request.context.tenantId,
      clinicId: request.context.clinicId,
      conversationId: request.context.conversationId,
      eventType: 'tool.requested',
      requestId: request.context.correlationId,
      metadata: {
        toolId: request.toolId,
        version: request.version,
        parameters: this.redactSensitive(request.parameters),
      },
    });
  }

  public async logValidated(request: ToolRequest): Promise<void> {
    await this.writeAudit({
      tenantId: request.context.tenantId,
      clinicId: request.context.clinicId,
      conversationId: request.context.conversationId,
      eventType: 'tool.validated',
      requestId: request.context.correlationId,
      metadata: { toolId: request.toolId },
    });
  }

  public async logExecuted(request: ToolRequest, latencyMs: number): Promise<void> {
    await this.writeAudit({
      tenantId: request.context.tenantId,
      clinicId: request.context.clinicId,
      conversationId: request.context.conversationId,
      eventType: 'tool.executed',
      requestId: request.context.correlationId,
      metadata: { toolId: request.toolId, latencyMs },
    });
  }

  public async logFailed(request: ToolRequest, error: Error): Promise<void> {
    await this.writeAudit({
      tenantId: request.context.tenantId,
      clinicId: request.context.clinicId,
      conversationId: request.context.conversationId,
      eventType: 'tool.failed',
      requestId: request.context.correlationId,
      metadata: {
        toolId: request.toolId,
        errorMessage: error.message,
        errorName: error.name,
      },
    });
  }

  public async logRetried(request: ToolRequest, attempt: number): Promise<void> {
    await this.writeAudit({
      tenantId: request.context.tenantId,
      clinicId: request.context.clinicId,
      conversationId: request.context.conversationId,
      eventType: 'tool.retried',
      requestId: request.context.correlationId,
      metadata: { toolId: request.toolId, attempt },
    });
  }

  public async logTimedOut(request: ToolRequest): Promise<void> {
    await this.writeAudit({
      tenantId: request.context.tenantId,
      clinicId: request.context.clinicId,
      conversationId: request.context.conversationId,
      eventType: 'tool.timedout',
      requestId: request.context.correlationId,
      metadata: { toolId: request.toolId },
    });
  }

  public async logDenied(request: ToolRequest, reason: string): Promise<void> {
    await this.writeAudit({
      tenantId: request.context.tenantId,
      clinicId: request.context.clinicId,
      conversationId: request.context.conversationId,
      eventType: 'tool.denied',
      requestId: request.context.correlationId,
      metadata: { toolId: request.toolId, reason },
    });
  }

  public async logCompleted(request: ToolRequest, result: ToolResult): Promise<void> {
    await this.writeAudit({
      tenantId: request.context.tenantId,
      clinicId: request.context.clinicId,
      conversationId: request.context.conversationId,
      eventType: 'tool.completed',
      requestId: request.context.correlationId,
      metadata: {
        toolId: request.toolId,
        status: result.status,
        executionTimeMs: result.executionTimeMs,
        result: result.result ? this.redactSensitive(result.result) : null,
      },
    });
  }

  // ---------------------------------------------------------------------------
  // Internal Logger
  // ---------------------------------------------------------------------------
  private async writeAudit(data: {
    tenantId: string;
    clinicId: string | null;
    conversationId: string;
    eventType: string;
    requestId: string;
    metadata: Record<string, unknown>;
  }): Promise<void> {
    try {
      await this.prisma.aiAuditLog.create({
        data: {
          tenantId: data.tenantId,
          clinicId: data.clinicId,
          conversationId: data.conversationId,
          provider: 'tool-pipeline',
          eventType: data.eventType,
          requestId: data.requestId,
          metadata: data.metadata as Prisma.InputJsonValue,
        },
      });
    } catch (err) {
      console.error('[ToolAuditLogger] Failed to write database log:', err);
    }
  }

  private redactSensitive(payload: Record<string, unknown>): Record<string, unknown> {
    const copy = { ...payload };
    const redactList = ['ssn', 'dob', 'token', 'secret', 'password', 'key', 'apiKey', 'jwt', 'auth'];

    for (const key of Object.keys(copy)) {
      if (redactList.some((r) => key.toLowerCase().includes(r))) {
        copy[key] = '[REDACTED]';
      }
    }
    return copy;
  }
}

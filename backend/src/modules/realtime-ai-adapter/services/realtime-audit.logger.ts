import type { PrismaClient } from '@prisma/client';
import { Prisma } from '@prisma/client';
import type { IRealtimeAuditLogger } from '../interfaces/realtime-ai.interfaces';

export class RealtimeAuditLogger implements IRealtimeAuditLogger {
  constructor(private readonly prisma: PrismaClient) {}

  public async logSessionCreated(
    sessionId: string,
    tenantId: string,
    provider: string,
    conversationId: string
  ): Promise<void> {
    await this.writeAudit({
      tenantId,
      clinicId: null,
      conversationId,
      provider,
      eventType: 'realtime.session.created',
      metadata: { sessionId },
    });
  }

  public async logSessionClosed(
    sessionId: string,
    tenantId: string,
    conversationId: string
  ): Promise<void> {
    await this.writeAudit({
      tenantId,
      clinicId: null,
      conversationId,
      provider: 'realtime-adapter',
      eventType: 'realtime.session.closed',
      metadata: { sessionId },
    });
  }

  public async logProviderError(
    sessionId: string,
    tenantId: string,
    conversationId: string,
    code: string,
    message: string
  ): Promise<void> {
    await this.writeAudit({
      tenantId,
      clinicId: null,
      conversationId,
      provider: 'realtime-adapter',
      eventType: 'realtime.provider.error',
      metadata: { sessionId, code, message },
    });
  }

  public async logReconnectAttempt(
    sessionId: string,
    tenantId: string,
    conversationId: string,
    attempt: number
  ): Promise<void> {
    await this.writeAudit({
      tenantId,
      clinicId: null,
      conversationId,
      provider: 'realtime-adapter',
      eventType: 'realtime.reconnect.attempt',
      metadata: { sessionId, attempt },
    });
  }

  public async logToolRequestReceived(
    sessionId: string,
    tenantId: string,
    conversationId: string,
    toolCallId: string,
    toolName: string
  ): Promise<void> {
    await this.writeAudit({
      tenantId,
      clinicId: null,
      conversationId,
      provider: 'realtime-adapter',
      eventType: 'realtime.tool_call.received',
      metadata: { sessionId, toolCallId, toolName },
    });
  }

  public async logConfigurationLoaded(
    sessionId: string,
    tenantId: string,
    conversationId: string
  ): Promise<void> {
    await this.writeAudit({
      tenantId,
      clinicId: null,
      conversationId,
      provider: 'realtime-adapter',
      eventType: 'realtime.configuration.loaded',
      metadata: { sessionId },
    });
  }

  public async logPromptVersionUsed(
    sessionId: string,
    tenantId: string,
    conversationId: string,
    promptId: string,
    version: number
  ): Promise<void> {
    await this.writeAudit({
      tenantId,
      clinicId: null,
      conversationId,
      provider: 'realtime-adapter',
      eventType: 'realtime.prompt.version.used',
      metadata: { sessionId, promptId, version },
    });
  }

  // ---------------------------------------------------------------------------
  // Internal Logger
  // ---------------------------------------------------------------------------

  private async writeAudit(data: {
    tenantId: string;
    clinicId: string | null;
    conversationId: string;
    provider: string;
    eventType: string;
    metadata: Record<string, unknown>;
  }): Promise<void> {
    // Sanitize any metadata to prevent raw audio or PHI/secret leaks
    const sanitizedMetadata = this.sanitizeMetadata(data.metadata);

    try {
      await this.prisma.aiAuditLog.create({
        data: {
          tenantId: data.tenantId,
          clinicId: data.clinicId,
          conversationId: data.conversationId,
          provider: data.provider,
          eventType: data.eventType,
          requestId: null,
          metadata: sanitizedMetadata as Prisma.InputJsonValue,
        },
      });
    } catch (err) {
      console.error('[RealtimeAuditLogger] Failed to write database log:', err);
    }
  }

  private sanitizeMetadata(metadata: Record<string, unknown>): Record<string, unknown> {
    const copy = { ...metadata };
    const redactKeys = ['payload', 'audio', 'token', 'secret', 'password', 'key', 'apiKey', 'ssn', 'dob', 'name', 'phone'];
    
    for (const key of Object.keys(copy)) {
      if (redactKeys.some((r) => key.toLowerCase().includes(r))) {
        copy[key] = '[REDACTED]';
      }
    }
    return copy;
  }
}

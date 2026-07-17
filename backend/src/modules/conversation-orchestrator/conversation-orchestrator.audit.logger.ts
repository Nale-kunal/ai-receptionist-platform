import type { PrismaClient } from '@prisma/client';
import { Prisma } from '@prisma/client';
import type { IOrchestratorAuditLogger } from './conversation-orchestrator.interfaces';
import type { EventCorrelation } from './conversation-orchestrator.types';

export class OrchestratorAuditLogger implements IOrchestratorAuditLogger {
  constructor(private readonly prisma: PrismaClient) {}

  public async logSessionCreated(
    sessionId: string,
    tenantId: string,
    conversationId: string,
    correlation: EventCorrelation
  ): Promise<void> {
    await this.writeAudit({
      tenantId,
      conversationId,
      eventType: 'orchestrator.session.created',
      correlation,
      metadata: { sessionId },
    });
  }

  public async logSessionClosed(
    sessionId: string,
    tenantId: string,
    conversationId: string,
    correlation: EventCorrelation
  ): Promise<void> {
    await this.writeAudit({
      tenantId,
      conversationId,
      eventType: 'orchestrator.session.closed',
      correlation,
      metadata: { sessionId },
    });
  }

  public async logStateTransition(
    sessionId: string,
    tenantId: string,
    from: string,
    to: string,
    correlation: EventCorrelation
  ): Promise<void> {
    await this.writeAudit({
      tenantId,
      conversationId: correlation.conversationId,
      eventType: 'orchestrator.state.transition',
      correlation,
      metadata: { sessionId, from, to },
    });
  }

  public async logTimeoutTriggered(
    sessionId: string,
    tenantId: string,
    timeoutType: string,
    limitMs: number,
    correlation: EventCorrelation
  ): Promise<void> {
    await this.writeAudit({
      tenantId,
      conversationId: correlation.conversationId,
      eventType: 'orchestrator.timeout.triggered',
      correlation,
      metadata: { sessionId, timeoutType, limitMs },
    });
  }

  public async logInterruptionDetected(
    sessionId: string,
    tenantId: string,
    audioOffsetMs: number,
    correlation: EventCorrelation
  ): Promise<void> {
    await this.writeAudit({
      tenantId,
      conversationId: correlation.conversationId,
      eventType: 'orchestrator.interruption.detected',
      correlation,
      metadata: { sessionId, audioOffsetMs },
    });
  }

  public async logSnapshotCreated(
    sessionId: string,
    tenantId: string,
    snapshotId: string,
    correlation: EventCorrelation
  ): Promise<void> {
    await this.writeAudit({
      tenantId,
      conversationId: correlation.conversationId,
      eventType: 'orchestrator.snapshot.created',
      correlation,
      metadata: { sessionId, snapshotId },
    });
  }

  public async logSessionRecovered(
    sessionId: string,
    tenantId: string,
    correlation: EventCorrelation
  ): Promise<void> {
    await this.writeAudit({
      tenantId,
      conversationId: correlation.conversationId,
      eventType: 'orchestrator.session.recovered',
      correlation,
      metadata: { sessionId },
    });
  }

  // ---------------------------------------------------------------------------
  // Internal Logger
  // ---------------------------------------------------------------------------

  private async writeAudit(data: {
    tenantId: string;
    conversationId: string;
    eventType: string;
    correlation: EventCorrelation;
    metadata: Record<string, unknown>;
  }): Promise<void> {
    const sanitizedMetadata = this.sanitizeMetadata({
      ...data.metadata,
      correlationId: data.correlation.correlationId,
      traceId: data.correlation.traceId,
      timestamp: data.correlation.timestamp,
    });

    try {
      await this.prisma.aiAuditLog.create({
        data: {
          tenantId: data.tenantId,
          clinicId: null,
          conversationId: data.conversationId,
          provider: 'orchestrator',
          eventType: data.eventType,
          requestId: data.correlation.correlationId,
          metadata: sanitizedMetadata as Prisma.InputJsonValue,
        },
      });
    } catch (err) {
      console.error('[OrchestratorAudit] Failed to write database log:', err);
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

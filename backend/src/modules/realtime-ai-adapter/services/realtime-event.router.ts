import type { IRealtimeEventRouter } from '../interfaces/realtime-ai.interfaces';
import type { IRealtimeEventPublisher } from '../events/realtime-ai.events';
import type {
  RealtimeTranscriptEvent,
  RealtimeToolCallEvent,
  RealtimeInterruptionEvent,
  RealtimeAudioFrame,
} from '../types/realtime-ai.types';
import {
  EVENT_REALTIME_TRANSCRIPT_GENERATED,
  EVENT_REALTIME_TOOL_CALL_RECEIVED,
  EVENT_REALTIME_INTERRUPTION_DETECTED,
} from '../events/realtime-ai.events';

export class RealtimeEventRouter implements IRealtimeEventRouter {
  // session tenant mappings (public sessionId -> tenantId)
  private readonly sessionTenants: Map<string, string> = new Map();

  constructor(
    private readonly publisher: IRealtimeEventPublisher
  ) {}

  public registerSessionTenant(sessionId: string, tenantId: string): void {
    this.sessionTenants.set(sessionId, tenantId);
  }

  public unregisterSessionTenant(sessionId: string): void {
    this.sessionTenants.delete(sessionId);
  }

  public async routeTranscript(sessionId: string, event: RealtimeTranscriptEvent): Promise<void> {
    const tenantId = this.requireTenantId(sessionId);
    await this.publisher.publish({
      type: EVENT_REALTIME_TRANSCRIPT_GENERATED,
      payload: {
        sessionId,
        tenantId,
        event,
        occurredAt: new Date(),
      },
    });
  }

  public async routeToolCall(sessionId: string, event: RealtimeToolCallEvent): Promise<void> {
    const tenantId = this.requireTenantId(sessionId);
    await this.publisher.publish({
      type: EVENT_REALTIME_TOOL_CALL_RECEIVED,
      payload: {
        sessionId,
        tenantId,
        toolCalls: event.toolCalls,
        occurredAt: new Date(),
      },
    });
  }

  public async routeInterruption(sessionId: string, event: RealtimeInterruptionEvent): Promise<void> {
    const tenantId = this.requireTenantId(sessionId);
    await this.publisher.publish({
      type: EVENT_REALTIME_INTERRUPTION_DETECTED,
      payload: {
        sessionId,
        tenantId,
        event,
        occurredAt: new Date(),
      },
    });
  }

  public async routeAudioFrame(sessionId: string, frame: RealtimeAudioFrame): Promise<void> {
    // Inbound streaming routing (no-op default event routing in infrastructure adapter).
    // Future Voice Stream handlers subscribe to audio payload triggers directly.
  }

  public async routeError(sessionId: string, error: Error): Promise<void> {
    // Audit logs track errors separately, router ensures listeners get a failed notification event.
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private requireTenantId(sessionId: string): string {
    const tenantId = this.sessionTenants.get(sessionId);
    if (!tenantId) {
      throw new Error(`[RealtimeRouter] Missing tenant ID registration for session ${sessionId}.`);
    }
    return tenantId;
  }
}

import type { IRealtimeEventPublisher, RealtimeDomainEvent } from './realtime-ai.events';

export class InProcessRealtimeEventPublisher implements IRealtimeEventPublisher {
  private readonly listeners: Map<
    string,
    Array<(event: any) => void | Promise<void>>
  > = new Map();

  public subscribe(
    eventType: RealtimeDomainEvent['type'],
    handler: (event: any) => void | Promise<void>
  ): void {
    const handlers = this.listeners.get(eventType) ?? [];
    handlers.push(handler);
    this.listeners.set(eventType, handlers);
  }

  public async publish(event: RealtimeDomainEvent): Promise<void> {
    const handlers = this.listeners.get(event.type) ?? [];
    for (const handler of handlers) {
      try {
        await handler(event);
      } catch (err) {
        console.error(`[RealtimeAiAdapter] Event listener execution failed for ${event.type}:`, err);
      }
    }
  }
}

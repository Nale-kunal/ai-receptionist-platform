import type { IOrchestratorEventPublisher, OrchestratorDomainEvent } from './conversation-orchestrator.events';

export class InProcessOrchestratorEventPublisher implements IOrchestratorEventPublisher {
  private readonly listeners: Map<
    string,
    Array<(event: any) => void | Promise<void>>
  > = new Map();

  public subscribe(
    eventType: OrchestratorDomainEvent['type'],
    handler: (event: any) => void | Promise<void>
  ): void {
    const handlers = this.listeners.get(eventType) ?? [];
    handlers.push(handler);
    this.listeners.set(eventType, handlers);
  }

  public async publish(event: OrchestratorDomainEvent): Promise<void> {
    const handlers = this.listeners.get(event.type) ?? [];
    for (const handler of handlers) {
      try {
        await handler(event);
      } catch (err) {
        console.error(`[ConversationOrchestrator] Event listener failed for ${event.type}:`, err);
      }
    }
  }
}

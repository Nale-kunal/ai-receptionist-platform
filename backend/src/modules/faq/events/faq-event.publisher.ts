import type { FaqDomainEvent } from './faq.events';

export interface IFaqEventPublisher {
  publish(event: FaqDomainEvent): Promise<void>;
}

export class InProcessFaqEventPublisher implements IFaqEventPublisher {
  private readonly listeners: Map<string, Array<(event: FaqDomainEvent) => void | Promise<void>>>;

  constructor() {
    this.listeners = new Map();
  }

  public subscribe(
    eventType: FaqDomainEvent['type'],
    handler: (event: any) => void | Promise<void>,
  ): void {
    const handlers = this.listeners.get(eventType) ?? [];
    handlers.push(handler);
    this.listeners.set(eventType, handlers);
  }

  public async publish(event: FaqDomainEvent): Promise<void> {
    const handlers = this.listeners.get(event.type) ?? [];
    for (const handler of handlers) {
      try {
        await handler(event);
      } catch (err) {
        console.error(`Error in FAQ event handler for ${event.type}:`, err);
      }
    }
  }
}

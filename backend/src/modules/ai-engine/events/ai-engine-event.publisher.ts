/**
 * AI Engine In-Process Event Publisher
 */

import type { IAiEngineEventPublisher } from '../interfaces/ai-engine.interfaces';
import type { AiEngineDomainEvent } from './ai-engine.events';

export class InProcessAiEngineEventPublisher implements IAiEngineEventPublisher {
  private readonly listeners: Map<
    string,
    Array<(event: AiEngineDomainEvent) => void | Promise<void>>
  >;

  constructor() {
    this.listeners = new Map();
  }

  public subscribe(
    eventType: AiEngineDomainEvent['type'],
    handler: (event: AiEngineDomainEvent) => void | Promise<void>,
  ): void {
    const handlers = this.listeners.get(eventType) ?? [];
    handlers.push(handler);
    this.listeners.set(eventType, handlers);
  }

  public async publish(event: AiEngineDomainEvent): Promise<void> {
    const handlers = this.listeners.get(event.type) ?? [];
    for (const handler of handlers) {
      try {
        await handler(event);
      } catch (err) {
        console.error(`Error in AI Engine event handler for ${event.type}:`, err);
      }
    }
  }
}

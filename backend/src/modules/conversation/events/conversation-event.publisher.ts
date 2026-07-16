/**
 * Conversation Event Publisher
 *
 * In-process event broker following the InProcessPatientEventPublisher pattern.
 */

import type { ConversationDomainEvent } from './conversation.events';

export interface IConversationEventPublisher {
  publish(event: ConversationDomainEvent): Promise<void>;
}

export class InProcessConversationEventPublisher implements IConversationEventPublisher {
  private readonly listeners: Map<
    string,
    Array<(event: ConversationDomainEvent) => void | Promise<void>>
  >;

  constructor() {
    this.listeners = new Map();
  }

  public subscribe(
    eventType: ConversationDomainEvent['type'],
    handler: (event: ConversationDomainEvent) => void | Promise<void>,
  ): void {
    const handlers = this.listeners.get(eventType) ?? [];
    handlers.push(handler);
    this.listeners.set(eventType, handlers);
  }

  public async publish(event: ConversationDomainEvent): Promise<void> {
    const handlers = this.listeners.get(event.type) ?? [];
    for (const handler of handlers) {
      try {
        await handler(event);
      } catch (err) {
        console.error(`Error in conversation event handler for ${event.type}:`, err);
      }
    }
  }
}

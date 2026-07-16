/**
 * Notification Event Publisher
 *
 * In-process event broker following Patient/Appointment module pattern.
 */

import type { NotificationDomainEvent } from './notification.events';

export interface INotificationEventPublisher {
  publish(event: NotificationDomainEvent): Promise<void>;
}

export class InProcessNotificationEventPublisher implements INotificationEventPublisher {
  private readonly listeners: Map<
    string,
    Array<(event: NotificationDomainEvent) => void | Promise<void>>
  >;

  constructor() {
    this.listeners = new Map();
  }

  public subscribe(
    eventType: NotificationDomainEvent['type'],
    handler: (event: NotificationDomainEvent) => void | Promise<void>,
  ): void {
    const handlers = this.listeners.get(eventType) ?? [];
    handlers.push(handler);
    this.listeners.set(eventType, handlers);
  }

  public async publish(event: NotificationDomainEvent): Promise<void> {
    const handlers = this.listeners.get(event.type) ?? [];
    for (const handler of handlers) {
      try {
        await handler(event);
      } catch (err) {
        console.error(`Error in notification event handler for ${event.type}:`, err);
      }
    }
  }
}

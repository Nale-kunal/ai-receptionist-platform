/**
 * Calendar Event Publisher
 *
 * In-process event broker matching the architecture of other modules.
 */

import type { CalendarDomainEvent } from './calendar.events';

export interface ICalendarEventPublisher {
  publish(event: CalendarDomainEvent): Promise<void>;
}

export class InProcessCalendarEventPublisher implements ICalendarEventPublisher {
  private readonly listeners: Map<
    string,
    Array<(event: CalendarDomainEvent) => void | Promise<void>>
  >;

  constructor() {
    this.listeners = new Map();
  }

  public subscribe(
    eventType: CalendarDomainEvent['type'],
    handler: (event: CalendarDomainEvent) => void | Promise<void>,
  ): void {
    const handlers = this.listeners.get(eventType) ?? [];
    handlers.push(handler);
    this.listeners.set(eventType, handlers);
  }

  public async publish(event: CalendarDomainEvent): Promise<void> {
    const handlers = this.listeners.get(event.type) ?? [];
    for (const handler of handlers) {
      try {
        await handler(event);
      } catch (err) {
        console.error(`Error in calendar event handler for ${event.type}:`, err);
      }
    }
  }
}

/**
 * Doctor Event Publisher
 *
 * Implements a lightweight in-process event broker for decoupled doctor audit trail hooks.
 */

import type { DoctorDomainEvent } from './doctor.events';

export interface IDoctorEventPublisher {
  publish(event: DoctorDomainEvent): Promise<void>;
}

export class InProcessDoctorEventPublisher implements IDoctorEventPublisher {
  private readonly listeners: Map<string, Array<(event: DoctorDomainEvent) => void | Promise<void>>>;

  constructor() {
    this.listeners = new Map();
  }

  public subscribe(
    eventType: DoctorDomainEvent['type'],
    handler: (event: any) => void | Promise<void>,
  ): void {
    const handlers = this.listeners.get(eventType) ?? [];
    handlers.push(handler);
    this.listeners.set(eventType, handlers);
  }

  public async publish(event: DoctorDomainEvent): Promise<void> {
    const handlers = this.listeners.get(event.type) ?? [];
    for (const handler of handlers) {
      try {
        await handler(event);
      } catch (err) {
        // Event processing should not block the main transaction flow
        console.error(`Error in doctor event handler for ${event.type}:`, err);
      }
    }
  }
}

/**
 * Clinic Event Publisher
 *
 * Implements a lightweight in-process event broker for decoupled clinic audit trail hooks.
 */

import type { ClinicDomainEvent } from './clinic.events';

export interface IClinicEventPublisher {
  publish(event: ClinicDomainEvent): Promise<void>;
}

export class InProcessClinicEventPublisher implements IClinicEventPublisher {
  private readonly listeners: Map<string, Array<(event: ClinicDomainEvent) => void | Promise<void>>>;

  constructor() {
    this.listeners = new Map();
  }

  public subscribe(
    eventType: ClinicDomainEvent['type'],
    handler: (event: any) => void | Promise<void>,
  ): void {
    const handlers = this.listeners.get(eventType) ?? [];
    handlers.push(handler);
    this.listeners.set(eventType, handlers);
  }

  public async publish(event: ClinicDomainEvent): Promise<void> {
    const handlers = this.listeners.get(event.type) ?? [];
    for (const handler of handlers) {
      try {
        await handler(event);
      } catch (err) {
        // Event processing should not block the main transaction flow
        console.error(`Error in clinic event handler for ${event.type}:`, err);
      }
    }
  }
}

/**
 * Appointment Event Publisher
 *
 * In-process event broker for appointment audit events.
 * Follows the same pattern as InProcessPatientEventPublisher.
 */

import type { AppointmentDomainEvent } from './appointment.events';

export interface IAppointmentEventPublisher {
  publish(event: AppointmentDomainEvent): Promise<void>;
}

export class InProcessAppointmentEventPublisher implements IAppointmentEventPublisher {
  private readonly listeners: Map<string, Array<(event: AppointmentDomainEvent) => void | Promise<void>>>;

  constructor() {
    this.listeners = new Map();
  }

  public subscribe(
    eventType: AppointmentDomainEvent['type'],
    handler: (event: AppointmentDomainEvent) => void | Promise<void>,
  ): void {
    const handlers = this.listeners.get(eventType) ?? [];
    handlers.push(handler);
    this.listeners.set(eventType, handlers);
  }

  public async publish(event: AppointmentDomainEvent): Promise<void> {
    const handlers = this.listeners.get(event.type) ?? [];
    for (const handler of handlers) {
      try {
        await handler(event);
      } catch (err) {
        console.error(`Error in appointment event handler for ${event.type}:`, err);
      }
    }
  }
}

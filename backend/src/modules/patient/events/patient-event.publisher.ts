/**
 * Patient Event Publisher
 *
 * Implements an in-process event broker for patient audit logs.
 */

import type { PatientDomainEvent } from './patient.events';

export interface IPatientEventPublisher {
  publish(event: PatientDomainEvent): Promise<void>;
}

export class InProcessPatientEventPublisher implements IPatientEventPublisher {
  private readonly listeners: Map<string, Array<(event: PatientDomainEvent) => void | Promise<void>>>;

  constructor() {
    this.listeners = new Map();
  }

  public subscribe(
    eventType: PatientDomainEvent['type'],
    handler: (event: any) => void | Promise<void>,
  ): void {
    const handlers = this.listeners.get(eventType) ?? [];
    handlers.push(handler);
    this.listeners.set(eventType, handlers);
  }

  public async publish(event: PatientDomainEvent): Promise<void> {
    const handlers = this.listeners.get(event.type) ?? [];
    for (const handler of handlers) {
      try {
        await handler(event);
      } catch (err) {
        console.error(`Error in patient event handler for ${event.type}:`, err);
      }
    }
  }
}

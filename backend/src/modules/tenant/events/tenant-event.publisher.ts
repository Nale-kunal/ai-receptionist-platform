/**
 * Tenant Event Publisher
 *
 * Implements a lightweight in-process event broker for decoupled audit trail hooks.
 */

import type { TenantDomainEvent } from './tenant.events';

export interface ITenantEventPublisher {
  publish(event: TenantDomainEvent): Promise<void>;
}

export class InProcessTenantEventPublisher implements ITenantEventPublisher {
  private readonly listeners: Map<string, Array<(event: TenantDomainEvent) => void | Promise<void>>>;

  constructor() {
    this.listeners = new Map();
  }

  public subscribe(
    eventType: TenantDomainEvent['eventType'],
    handler: (event: any) => void | Promise<void>,
  ): void {
    const handlers = this.listeners.get(eventType) ?? [];
    handlers.push(handler);
    this.listeners.set(eventType, handlers);
  }

  public async publish(event: TenantDomainEvent): Promise<void> {
    const handlers = this.listeners.get(event.eventType) ?? [];
    for (const handler of handlers) {
      try {
        await handler(event);
      } catch (err) {
        // Event processing should not block the main transaction flow
        console.error(`Error in tenant event handler for ${event.eventType}:`, err);
      }
    }
  }
}
